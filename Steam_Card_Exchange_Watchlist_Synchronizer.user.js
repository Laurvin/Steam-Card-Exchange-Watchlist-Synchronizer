// ==UserScript==
// @name        Steam Card Exchange Watchlist Synchronizer
// @namespace   DB
// @version     0.1
// @description Synchs with actual Steam Inventory
// @icon        http://i.imgur.com/XYzKXzK.png
// @include     http://www.steamcardexchange.net/index.php?userlist
// @grant       GM_xmlhttpRequest
// @require     http://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js
// @require     https://raw.githubusercontent.com/Sighery/SRQ/master/SerialRequestsQueue.js
// ==/UserScript==

var queue = new SRQ();

var Steamids = [];

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
	$('#SynchDiv').append('<p id="SteamInvTotals">Loading Steam Inventory in 2,000 item chunks.</p>');
	$('#SynchDiv').append('<p id="SteamInvLoading">Still loading...</p>');

	queue.add_to_queue(
		{
			"link": "http://steamcommunity.com/my/inventory/json/753/6",
			"method": "GET",
			"timeout": 5000
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

		$.each(InvJSON.rgDescriptions, function (index, item)
			   {
			if (item.type.includes("Trading Card"))
			{
				if(Steamids.includes(item.market_fee_app))
				{
					// If it's in the array already, do nothing; we need each appID only once.
				}
				else
				{
					Steamids.push(item.market_fee_app);
				}
			}
		});

		$('#SteamInvTotals').text('Number of games with cards in Steam Inventory: ' + Steamids.length);

		if (InvJSON.more === true)
		{
			queue.add_to_queue(
				{
					"link": "http://steamcommunity.com/my/inventory/json/753/6?start=" + InvJSON.more_start,
					"method": "GET",
					"timeout": 5000
				});

			queue.start(inv_request_callback);
		}
		else
		{
			console.log("All loaded!");
			$('#SteamInvLoading').text('All loaded!');

			var SCEids = $('.even, .odd').map(function() // Filling array with all games in SCE Watchlist.
			{
				return this.id.substring(6);
			}).get();

			console.log("Number of games in SCE Watchlist", SCEids.length);
			$('#SynchDiv').append('<p>Number of games in SCE Watchlist: ' + SCEids.length + '</p>');

			var SCEids2 = new Set(SCEids);
			var InSteamInvNotInSCE = [...new Set([...Steamids].filter(x => !SCEids2.has(x)))];

			console.log("Games in Steam Inventory but not in Watchlist", InSteamInvNotInSCE.length);
			$('#SynchDiv').append('<p><br />Games in Steam Inventory but not in Watchlist: ' + InSteamInvNotInSCE.length + '<br /</p>');

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

			console.log("Games in Watchlist but not in Steam Inventory", InSCENotInSteamInv.length);
			$('#SynchDiv').append('<p><br />Games in Watchlist but not in Steam Inventory: ' + InSCENotInSteamInv.length + '<br /></p>');

			if (InSCENotInSteamInv.length > 0)
			{
				$.each(InSCENotInSteamInv, function (index, item)
				{
					$('#SynchDiv').append('<a id="id' + item + '" href="http://www.steamcardexchange.net/index.php?inventorygame-appid-' + item + '" style="display:inline-block;min-width:50px;margin: 4px 3px 4px 0;">' + item + '</a>');
				});
				AddRemoveFromSCEWatchlist("remove", InSCENotInSteamInv);
			}

			$('#SynchDiv').append('<p><br />Working... AppIDs in green and/or red above should have changed but rate limiting might have borked some so it pays to check. SYNCH button removed till page reload.</p>');
			$('#SynchIt').remove();
		}

	}
	else
	{
		console.log("Fail");
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
			timeout: 5000,
			statusCode:
			{
				503: function (response)
				{
					$('#SynchDiv').append('<p>Ran into a 503 error! Rate limiting stops us from processing more for now.</p>');
					return;
				}
			},
				success: function(html, textStatus)
			{
				console.log(add_or_remove, current_id);
				$("#id" + current_id).css("color", IDcolor);
				myVar = setTimeout(AddRemoveFromSCEWatchlist, 2000, add_or_remove, appIDs);
			},
			error : function(xhr, status, errorThrown)
			{
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
