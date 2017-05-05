// ==UserScript==
// @name Steam Card Exchange Watchlist Synchronizer
// @namespace Steam Card Exchange Watchlist Synchronizer
// @author Laurvin
// @description Synchs with actual Steam Inventory
// @version 0.6
// @icon http://i.imgur.com/XYzKXzK.png
// @downloadURL https://github.com/Laurvin/Steam-Card-Exchange-Watchlist-Synchronizer/raw/master/Steam_Card_Exchange_Watchlist_Synchronizer.user.js
// @include http://www.steamcardexchange.net/index.php?userlist
// @include https://www.steamcardexchange.net/index.php?userlist
// @grant GM_xmlhttpRequest
// @require https://github.com/Sighery/SRQ/releases/download/v0.1.0/SerialRequestsQueue-0.1.0.js
// @run-at document-idle
// ==/UserScript==

var queue = new SRQ();

var Steamids = [];

var InventoryAmounts = {};

var CardAmounts = {};

this.$ = this.jQuery = jQuery.noConflict(true);
$(document).ready(function ()
{
	init();
});
function init()
{

	addHTMLElements();
}
function addHTMLElements()
{
	$('.content-box-topbar-large').append('<button class="button-blue" id="SynchIt" style="margin-top: 25px; margin-right: 200px;">SYNCH</button>');
	$('#SynchIt').click(SynchLists);
}
function SynchLists()
{
	$('#inventory-content').prepend('<div class="content-box-normal" style="line-height: 20px;" id="SynchDiv"><p>Synching, please be patient and keep in mind you need to be logged into Steam on this browser for this to work.</p></div>');
	$('#SynchDiv').append('<p>Loading Steam Inventory in 2,000 item chunks. <span id="SteamInvLoading">Loading from 0 onwards.</span> There will be a few seconds pause at the end.');
	$('#SynchDiv').append('<p>Number of games with cards in Steam Inventory: <strong><span id="SteamInvTotals">0</span></strong></p>');
	queue.add_to_queue(
	{
		"link": "http://steamcommunity.com/my/inventory/json/753/6",
		"method": "GET",
		"timeout": 6000
	});

	if (queue.is_busy() === false)
	{
		queue.start(inv_request_callback);
	}
}

function inv_request_callback(requested_obj) {

	if (requested_obj.successful)
	{
		var InvJSON = JSON.parse(requested_obj.response.responseText);

		$.each(InvJSON.rgInventory, function (index, item)
		{
			if (hasOwnProperty(InventoryAmounts, item.classid+"_"+item.instanceid))
			{
				InventoryAmounts[item.classid+"_"+item.instanceid] += 1;
			}
			else
			{
				InventoryAmounts[item.classid+"_"+item.instanceid] = 1;
			}
		});

		$.each(InvJSON.rgDescriptions, function (index, item)
		{
			if (item.type.includes("Trading Card"))
			{
				if(Steamids.includes(item.market_fee_app))
				{
					CardAmounts[item.market_fee_app] += InventoryAmounts[item.classid+"_"+item.instanceid];
				}
				else
				{
					Steamids.push(item.market_fee_app);
					CardAmounts[item.market_fee_app] = InventoryAmounts[item.classid+"_"+item.instanceid];
					// CardAmounts[item.market_fee_app] = 1;
				}
			}
		});

		$('#SteamInvTotals').text(Steamids.length);

		if (InvJSON.more === true)
		{
			queue.add_to_queue(
			{
				"link": "http://steamcommunity.com/my/inventory/json/753/6?start=" + InvJSON.more_start,
				"method": "GET",
				"timeout": 6000
			});

			$('#SteamInvLoading').text('Loading from '+InvJSON.more_start+' onwards.');
			InvJSON = null;
			queue.start(inv_request_callback);
		}
		else
		{
			InvJSON = null;
			$('#SteamInvLoading').text('All loaded!');

			var SCEids = $('.even, .odd').map(function() // Filling array with all games in SCE Watchlist.
			{
				return this.id.substring(6);
			}).get();

			$('#SynchDiv').append('<p>Number of games in SCE Watchlist: <strong>' + SCEids.length + '</strong></p>');

			var SCEids2 = new Set(SCEids);
			var InSteamInvNotInSCE = [...new Set([...Steamids].filter(x => !SCEids2.has(x)))];

			$('#SynchDiv').append('<p><br />Games in Steam Inventory but not in Watchlist: <strong>' + InSteamInvNotInSCE.length + '</strong><br /</p>');

			if (InSteamInvNotInSCE.length > 0)
			{
				$.each(InSteamInvNotInSCE, function (index, item)
				{
					$('#SynchDiv').append('<a id="id' + item + '" href="http://www.steamcardexchange.net/index.php?inventorygame-appid-' + item + '" style="display:inline-block;min-width:50px;margin: 4px 3px 4px 0;">' + item + '</a>');
				});
				AddRemoveFromSCEWatchlist("add", InSteamInvNotInSCE);
			}

			var Steamids2 = new Set(Steamids);
			var InSCENotInSteamInv = [...new Set([...SCEids].filter(x => !Steamids2.has(x)))];

			$('#SynchDiv').append('<p><br />Games in Watchlist but not in Steam Inventory: <strong>' + InSCENotInSteamInv.length + '</strong><br /></p>');

			if (InSCENotInSteamInv.length > 0)
			{
				$.each(InSCENotInSteamInv, function (index, item)
				{
					$('#SynchDiv').append('<a id="id' + item + '" href="http://www.steamcardexchange.net/index.php?inventorygame-appid-' + item + '" style="display:inline-block;min-width:50px;margin: 4px 3px 4px 0;">' + item + '</a>');
				});
				AddRemoveFromSCEWatchlist("remove", InSCENotInSteamInv);
			}

			$('#SynchDiv').append('<p><br />Working... AppIDs should all turn green (when adding) or red (when deleting), if not, rate limiting might have borked some. It pays to check the result either way; there could always be weird bugs. SYNCH button removed till page reload.</p>');
			$('#SynchIt').remove();

			console.log("Starting Table Additions!");
			$("#inventorylist tr:first").append('<th title="Owned Cards">O C</th>');
			$("#inventorylist tr:first").append('<th title="Possible Badges to be created">P B</th>');
			$("#inventorylist tr:first").append('<th title="Cards remaining after crafting badges">C R</th>');

			var MyRows = $('#inventorylist').find('tbody').find('tr');

			for (var i = 0; i < MyRows.length; i++)
			{
				var appID = $(MyRows[i]).find('td:eq(1)').attr('id');
				appID = appID.substring(6);
				var SetSize = $(MyRows[i]).find('td:eq(3)').text();
				SetSize = SetSize.substring(SetSize.length - 9, SetSize.length - 7);
				if (CardAmounts[appID] === undefined) CardAmounts[appID] = 0; // If no cards in Inventory this throws up a problem.
				var BadgesAbleToCreate = Math.floor(CardAmounts[appID]/SetSize);
				var RemainingCards = CardAmounts[appID] - (BadgesAbleToCreate * SetSize);
				$(MyRows[i]).append('<td>'+CardAmounts[appID]+'</td>');
				$(MyRows[i]).append('<td>'+BadgesAbleToCreate+'</td>');
				$(MyRows[i]).append('<td>'+RemainingCards+'</td>');
			}

			$("#inventorylist").trigger("destroy");
			$("#inventorylist").tablesorter(
			{
				sortList: [[4,1]],
				widgets: ["zebra"]
			});

			console.log("Finished Table Additions!");
			
			CardAmounts = null;
		}

	}
	else
	{
		$('#SynchDiv').append('<p>FAILED to load (part of) Steam Inventory! See if this link works: <a href="http://steamcommunity.com/my/inventory/json/753/6">http://steamcommunity.com/my/inventory/json/753/6</a>, if not then Steam is down or things have changed. Reload this page to try again.</p>');
	}

	if (queue.is_busy() === false)
	{
		queue.start(normal_callback);
	}
}

function normal_callback(requested_obj)
{
	if (requested_obj.fallback_requested)
	{
		console.log("fallback_requested");
	}
	else
	{
		console.log("fallback_NOT_requested");
	}
}

function AddRemoveFromSCEWatchlist(add_or_remove, appIDs)
{
	var IDcolor = (add_or_remove == "add") ? "#1DAF07" : "#B52426";
	if (appIDs.length > 0)
	{
		var current_id = appIDs[0];
		console.log("current_id", current_id);
		appIDs.shift();
		$.ajax(
		{
			method: 'POST',
			url: 'http://www.steamcardexchange.net/index.php?inventorygame-appid-' + current_id,
			headers: { "Content-type" : "application/x-www-form-urlencoded" },
			data: encodeURI(add_or_remove+"=true"),
			timeout: 6000,
			statusCode:
			{
				503: function (response)
				{
					console.log("503'ed!");
					$('#SynchDiv').append('<p>Ran into a 503 error! Rate limiting stops us from processing more for now.</p>');
					return;
				}
			},
			success: function(html, textStatus)
			{
				console.log(add_or_remove, current_id);
				$("#id" + current_id).css("color", IDcolor);
				myVar = setTimeout(AddRemoveFromSCEWatchlist, 1500, add_or_remove, appIDs);
			},
			error : function(xhr, status, errorThrown)
			{
				console.log("Error! " + status + errorThrown);
				alert("Error! " + status + errorThrown);
			}
		});
	}
	else
	{
		console.log("Done adding.");
		$('#SynchDiv').append('<p>Processed all of <span style="color:' + IDcolor + ';">' + add_or_remove + '</span> list.</p>');
	}
}

function hasOwnProperty(obj, prop)
{
	var proto = obj.__proto__ || obj.constructor.prototype;
	return (prop in obj) &&
		(!(prop in proto) || proto[prop] !== obj[prop]);
}
