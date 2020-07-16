// ==UserScript==
// @name Steam Card Exchange Watchlist Synchronizer
// @namespace Steam Card Exchange Watchlist Synchronizer
// @author Laurvin
// @description Synchs with actual Steam Inventory
// @version 3.3
// @icon http://i.imgur.com/XYzKXzK.png
// @downloadURL https://github.com/Laurvin/Steam-Card-Exchange-Watchlist-Synchronizer/raw/master/Steam_Card_Exchange_Watchlist_Synchronizer.user.js
// @include http://www.steamcardexchange.net/index.php?userlist
// @include https://www.steamcardexchange.net/index.php?userlist
// @grant GM_xmlhttpRequest
// @run-at document-idle
// ==/UserScript==

/* globals jQuery, $ */

var Steamids = [];
var InventoryAmounts = {};
var CardAmounts = {};
var myVar;
var IncompleteLoad = false;

$(document).ready(function() {
    init();
});

function init() {
    addHTMLElements();
}

function addHTMLElements() {
    $('h1.empty').append('<button class="button-blue" id="SynchIt" style="margin-top: 25px;">SYNCH</button>');
    $('#SynchIt').click(SynchLists);
}

function SynchLists() {
    $('#inventory-content').prepend('<div class="content-box-normal" style="line-height: 20px;" id="SynchDiv"><p>Synching, please be patient and keep in mind you need to be logged into Steam on this browser for this to work.</p></div>');
    $('#SynchDiv').append('<p>Loading Steam Inventory in 2,000 item chunks. <span id="SteamInvLoading">Loading from 0 onwards.</span>');
    $('#SynchDiv').append('<p>Number of games with cards in Steam Inventory: <strong><span id="SteamInvTotals">0</span></strong></p>');
    loadInventory('https://steamcommunity.com/my/inventory/json/753/6');
}

function monkeyRequest(url) {
    return new Promise(function(resolve, reject) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            timeout: 25000,
            onload: function(response) {
                var InvJSON = JSON.parse(response.responseText);
                resolve(InvJSON);
            },
            onerror: function(response) {
				console.log(response.statusText);
				reject(response.statusText);
            },
            ontimeout: function(response) {
				reject("Timed out!");
            }
        });
    });
}

function loadInventory(url) {
    monkeyRequest(url).then(function(response) {
        parseInvJSON(response);
    }, function(error) {
        console.log(error);
        IncompleteLoad = true;
        $('#SynchDiv').append('<p>FAILED to load (part of) Steam Inventory! See if this link works: <a href="http://steamcommunity.com/my/inventory/json/753/6">http://steamcommunity.com/my/inventory/json/753/6</a>, if not then Steam is down or things have changed. Reload this page to try again.</p>');
    })
}

function parseInvJSON(InvJSON) {
    $.each(InvJSON.rgInventory, function(index, item) {
        if (hasOwnProperty(InventoryAmounts, item.classid + "_" + item.instanceid)) {
            InventoryAmounts[item.classid + "_" + item.instanceid] += 1;
        } else {
            InventoryAmounts[item.classid + "_" + item.instanceid] = 1;
        }
    });

    $.each(InvJSON.rgDescriptions, function(index, item) {
        if (!item.type.includes("Foil Trading Card") && item.type.includes("Trading Card")) {
            if (Steamids.includes(item.market_fee_app)) {
                CardAmounts[item.market_fee_app] += InventoryAmounts[item.classid + "_" + item.instanceid];
            } else {
                Steamids.push(item.market_fee_app);
                CardAmounts[item.market_fee_app] = InventoryAmounts[item.classid + "_" + item.instanceid];
            }
        }
    });

    $('#SteamInvTotals').text(Steamids.length);

    if (InvJSON.more === true) {
        $('#SteamInvLoading').text('Loading from ' + InvJSON.more_start + ' onwards.');
        loadInventory('http://steamcommunity.com/my/inventory/json/753/6?start=' + InvJSON.more_start);
    } else {
        console.log('IncompleteLoad', IncompleteLoad, 'success', InvJSON.success);
        if (IncompleteLoad === false && InvJSON.success === true)
		{
			makeChanges();
		}
		else
		{
			$('#SynchDiv').append('<p>FAILURE loading (part of) Steam Inventory! See if this link works: <a href="http://steamcommunity.com/my/inventory/json/753/6">http://steamcommunity.com/my/inventory/json/753/6</a>, if not then Steam is down or things have changed. Reload this page to try again.</p>');
		}
    }
}

function makeChanges() {
    $('#SteamInvLoading').text('All loaded!');

    var SCEids = $('table.dataTable a').map(function() // Filling array with all games in SCE Watchlist.
        {
            var SteamID = $(this).attr('href');
            SteamID = SteamID.substring(SteamID.lastIndexOf('-') + 1);
            return SteamID;
        }).get();

    $('#SynchDiv').append('<p>Number of games in SCE Watchlist (table below): <strong>' + SCEids.length + '</strong></p>');

    var SCEids2 = new Set(SCEids);
    var InSteamInvNotInSCE = [...new Set([...Steamids].filter(x => !SCEids2.has(x)))];

    $('#SynchDiv').append('<p><br />Games in Steam Inventory but not in Watchlist: <strong>' + InSteamInvNotInSCE.length + '</strong></p>');

    if (InSteamInvNotInSCE.length > 0) {
        $.each(InSteamInvNotInSCE, function(index, item) {
            $('#SynchDiv').append('<a id="id' + item + '" href="https://www.steamcardexchange.net/index.php?inventorygame-appid-' + item + '" style="display:inline-block;min-width:50px;margin: 4px 3px 4px 0;" target="_blank">' + item + '</a>');
        });
        AddRemoveFromSCEWatchlist("add", InSteamInvNotInSCE);
    }

    var Steamids2 = new Set(Steamids);
    var InSCENotInSteamInv = [...new Set([...SCEids].filter(x => !Steamids2.has(x)))];

    $('#SynchDiv').append('<p><br />Games in Watchlist but not in Steam Inventory: <strong>' + InSCENotInSteamInv.length + '</strong><br /></p>');

    if (InSCENotInSteamInv.length > 0) {
        $.each(InSCENotInSteamInv, function(index, item) {
            $('#SynchDiv').append('<a id="id' + item + '" href="https://www.steamcardexchange.net/index.php?inventorygame-appid-' + item + '" style="display:inline-block;min-width:50px;margin: 4px 3px 4px 0;" target="_blank">' + item + '</a>');
        });
        AddRemoveFromSCEWatchlist("remove", InSCENotInSteamInv);
    }

    $('#SynchDiv').append('<p><br />Working... AppIDs should turn green or red one by one, if not, rate limiting might have borked it. It pays to check results; bugs are always possible.</p>');
    $('#SynchIt').remove();

    console.log("Starting Table Additions!");
    $("#private_watchlist tr:first").append('<th title="Cards Owned">C O</th>');
    $("#private_watchlist tr:first").append('<th title="Possible Badges to be created">P B</th>');
    $("#private_watchlist tr:first").append('<th title="Cards needed for another badge">C N</th>');
    $("#private_watchlist tr:first").append('<th title="Cards remaining after crafting badges">C R</th>');

    var MyRows = $('#private_watchlist').find('tbody').find('tr');

    for (var i = 0; i < MyRows.length; i++) {
        var appID = $(MyRows[i]).find('a').attr('href');
        appID = appID.substring(appID.lastIndexOf('-') + 1);
        var SetSize = $(MyRows[i]).find('td:eq(3)').text();
        var SetSizeStart = SetSize.indexOf('of');
        var SetSizeEnd = SetSize.indexOf(')');
        var CardsIncluded = (SetSize.indexOf('Cards') == -1) ? 0 : -5; // Need to subtract more if the word Cards is still there.
        SetSize = SetSize.substring(SetSizeStart + 3, SetSizeEnd + CardsIncluded);
        if (CardAmounts[appID] === undefined) CardAmounts[appID] = 0; // If no cards in Inventory this throws up a problem.
        var BadgesAbleToCreate = Math.floor(CardAmounts[appID] / SetSize);
        var RemainingCards = CardAmounts[appID] - (BadgesAbleToCreate * SetSize);
        var CardsNeeded = SetSize - RemainingCards;
        $(MyRows[i]).append('<td>' + CardAmounts[appID] + '</td>');
        $(MyRows[i]).append('<td>' + BadgesAbleToCreate + '</td>');
        $(MyRows[i]).append('<td>' + CardsNeeded + '</td>');
        $(MyRows[i]).append('<td>' + RemainingCards + '</td>');
    }

    $('#private_watchlist').dataTable({
        dom: 'rt<"dataTables_footer"ip>',
        "searching": false,
        "destroy": true,
        pageLength: -1,
        autoWidth: false,
        stateSave: true,
        "order": [
            [4, 'desc'],
            [0, 'asc']
        ]
    });

    console.log("Finished Table Additions!");
    CardAmounts = null;
}

function AddRemoveFromSCEWatchlist(add_or_remove, appIDs) {
    var IDcolor = (add_or_remove == "add") ? "#1DAF07" : "#B52426";
    if (appIDs.length > 0) {
        var current_id = appIDs[0];
        console.log("current_id", current_id);
        appIDs.shift();
        $.ajax({
            method: 'POST',
            url: 'https://www.steamcardexchange.net/index.php?inventorygame-appid-' + current_id,
            headers: {
                "Content-type": "application/x-www-form-urlencoded"
            },
            data: encodeURI(add_or_remove + "=true"),
            timeout: 6000,
            statusCode: {
                503: function(response) {
                    console.log("503'ed!");
                    $('#SynchDiv').append('<p>Ran into a 503 error! Rate limiting stops us from processing more for now.</p>');
                    return;
                }
            },
            success: function(html, textStatus) {
                console.log(add_or_remove, current_id);
                $("#id" + current_id).css("color", IDcolor);
                myVar = setTimeout(AddRemoveFromSCEWatchlist, 1500, add_or_remove, appIDs);
            },
            error: function(xhr, status, errorThrown) {
                console.log("Error! " + status + errorThrown);
                alert("Error! " + status + errorThrown);
            }
        });
    } else {
        console.log("Done adding/removing.");
        $('#SynchDiv').append('<p>Processed all of <span style="color:' + IDcolor + ';">' + add_or_remove + '</span> list.</p>');
    }
}

function hasOwnProperty(obj, prop) {
    var proto = obj.__proto__ || obj.constructor.prototype;
    return (prop in obj) &&
        (!(prop in proto) || proto[prop] !== obj[prop]);
}
