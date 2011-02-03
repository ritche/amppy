var currentUser = '';
var volume;
var stateTimer;
var templates = {};
var jsonSource = 'json.pl';
var playingTimer;
var elapsedTime = 0;
var totalTime = 0;
var queueLocked = false;
var queueHidden = false;

$(document).ready(function() {
	$("#queue-list").sortable({
		placeholder: "queue-song-placeholder",
		axis: "y",
		start: function() { queueLocked = true; },
		stop: function() { queueLocked = false; },
		update: updateQueueOrder
	});

	// templating
	templates.queueSong = $("li.queue-song").first().clone();
	templates.nowPlayingPanel = $("#now-playing-panel").clone();
	templates.searchResultSong = $("#search-results-entry").clone();
	$("#search-results-table tbody").empty();

	playerStateRequest();
	if (stateTimer) clearInterval(stateTimer);
	stateTimer = setInterval(function() {playerStateRequest();}, 15000)
	$("#search-results-table").tablesorter({widgets: ['zebra']});
	$(".header-bar-menu-root").hover(function() {
		$("#"+$(this).attr('id')+"-dropdown").show();
	});
	$('.header-bar-menu-dropdown').hover(function() {
	}, function() {
		$(this).hide();
	});
	$("#search-results-toggle-right-panel").click(function() { toggleQueue(); });
	$("#statistics-toggle-right-panel").click(function() { toggleQueue(); });
});

function toggleQueue() {
	if (queueHidden) {
		$("#right-panel").animate({
			right: '0'
		}, 400);
		$(".panel-left").animate({
			right: '300'
		}, 400);
		queueHidden = false;
	} else {
		$("#right-panel").animate({
			right: '-300'
		}, 400);
		$(".panel-left").animate({
			right: '0'
		}, 400);
		queueHidden = true;
	}
}

function titleOrPath(json) {
	if (json.title) {
		return json.title;
	} else {
		var shortname = /^.*\/(.*)$/.exec(json.path);
		if (shortname) {
			return shortname[1];
		} else {
			return json.path;
		}
	}
}

function readableTime(length) {
	if (length < 0) {length = 0;}
	var seconds = length % 60;
	var minutes = Math.floor(length / 60) % 60;
	var hours = Math.floor(length / 3600);
	if (hours) {
		return sprintf("%d:%02d:%02d",hours,minutes,seconds);
	} else {
		return sprintf("%d:%02d",minutes,seconds);
	}
}

function startPlayingTimer() {
	if (playingTimer) clearInterval(playingTimer);
	playingTimer = setInterval(function() { updatePlayingTime() }, 1000);
}

function updatePlayingTime() {
	if (elapsedTime < totalTime) {
		$('#now-playing-time').html(readableTime(++elapsedTime));
		$('#now-playing-progress').progressbar({value: Math.floor(100 * (elapsedTime/totalTime))});
	} else if (elapsedTime >= totalTime) {
		playerStateRequest();
	}
}

function playerStateRequest() {
	$.getJSON(
		jsonSource,
		function (json) {handlePlayerStateRequest(json);}
	);
}

function doSearch(field, value) {
	$("#search-results-status").html("Searching for '" + value + "'...");
	$.getJSON(jsonSource + "?mode=search;field=" + field + ";value=" + value,
		function (data) {
			$("#search-results-status").html("Processing " + data.length + " results.");
			if (data.length > 1000) {
				if (!confirm("Your search returned a lot of results (" + data.length +"). Do you still want to continue?")) {
					return false;
				}
			}
			fillResultTable(data);
			$("#search-results-status").html("Search results for '" + value + "'.");
	});
	return false;
}

function selectRequest(field, value) {
	$("#search-results-status").html("Searching for '" + value + "'...");
	$.getJSON(jsonSource + "?mode=select;field=" + field + ";value=" + value,
		function (data) {
			$("#search-results-status").html("Processing " + data.length + " results.");
			fillResultTable(data);
			$("#search-results-status").html("Songs where " + field + " is '"
				+ value + "'.");
	});
}

function loadRandomSongs(amount, seed) {
	$.getJSON(
		jsonSource + "?mode=random;amount=" + amount + ";seed=" + seed,
		function (data) {
			$('#search-results-random a').attr('href',
				'#RandomSongs/20/' + (new Date()).getTime());
			fillResultTable(data);
			$("#search-results-status").html(amount + " Random Songs");
		}
	);
}

function loadRecentSongs(amount) {
	$.getJSON(
		jsonSource + '?mode=recent;amount=' + amount,
		function (data) {
			fillResultTable(data);
			$("#search-results-status").html(amount + " Recently Added Songs");
		}
	);
}

function loadPlayHistory(amount, who) {
	$.getJSON(
		jsonSource + '?mode=history;amount=' + amount + ";who=" + who,
		function (data) {
			fillResultTable(data);
			var bywho = "";
			if (who) bywho = " By " + who;
			$("#search-results-status").html(amount + " Recently Played Songs"
				+ bywho);
		}
	);
}

function hideShow(what) {
	$("#"+what).toggle();
}

function hideShowSlide(what) {
	$("#"+what).slideToggle(300);
}

function fillResultTable(json) {
	$("#search-results-table tbody tr").remove();
	$("#search-results-table").trigger("update");
	if (json.length < 1) {
		$("#search-results-table tbody").append("<tr><td colspan=\"6\"><center><i>No results.</i></center></td></tr>");
		$("#search-results-time").html("0 seconds");
		$("#search-results-count").html("0 songs");
		return false;
	}
	var total_length = 0;
	$("#search-results-table tbody").empty();
	for (i in json) {
		var song = json[i];
		var entry = templates.searchResultSong.clone();
		$(".search-results-entry-song-id", entry).html(song.song_id);
		$(".search-results-entry-track", entry).html(song.track);
		$(".search-results-entry-length", entry).html(readableTime(song.length));

		$(".search-results-entry-vote", entry).attr('href',
			'javascript:voteSong(' + song.song_id + ')');

		$(".search-results-entry-title a", entry).html(song.title);
		$(".search-results-entry-title a", entry).attr('href',
			'#SongDetails/' + song.song_id);

		$(".search-results-entry-album a", entry).html(song.album);
		$(".search-results-entry-album a", entry).attr('href',
			'#SelectRequest/album/' + uriencode(song.album));

		$(".search-results-entry-artist a", entry).html(song.artist);
		$(".search-results-entry-artist a", entry).attr('href',
			'#SelectRequest/artist/' + uriencode(song.artist));
		$("#search-results-table tbody").append(entry);
		total_length += parseInt(song.length);
	}
	$("#search-results-table").trigger("update");
	$("#search-results-table").trigger("applyWidgets");
	$("#search-results-time").html(readableTime(total_length));
	if (json.length == 1) {
		$("#search-results-count").html("One song");
	} else {
		$("#search-results-count").html(json.length +" songs");
	}
}

function updateQueueOrder(event, ui) {
	$("#search-results-status").html("The queue was reordered.");
	var block = "";
	$("#queue-list .queue-song").each(function(index) {
		block += "song_id=" + $(".queue-song-id",this).text() + ";";
	});
	$.getJSON(
		jsonSource + '?mode=reorder_queue;' + block,
		function (data) {handlePlayerStateRequest(data);}
	);
}

function voteSong(song_id) {
	$.getJSON(
		jsonSource + '?mode=vote;song_id=' + song_id,
		function (data) {handlePlayerStateRequest(data);}
	);
}

function unvoteSong(song_id) {
	$.getJSON(
		jsonSource + '?mode=unvote;song_id=' + song_id,
		function (data) {handlePlayerStateRequest(data);}
	);
}

function changePlayer(player_id) {
	$.getJSON(
		jsonSource + "?mode=change_player;player_id="+player_id,
		function(data) { handlePlayerStateRequest(data);}
	);
}

function voteAll() {
	var block = "";
	$("#search-results-table tbody tr").each(function(index) {
		block += "song_id=" + $(".search-results-entry-song-id",this).text() + ";";
	});
	var command = "?mode=vote;";
	$.getJSON(
			jsonSource + command + block,
			function(data){handlePlayerStateRequest(data);}
	);
}

function voteOne() {
	var block = "";
	var length = $("#search-results-table tbody tr").length;
	var randomSelection = Math.floor(Math.random() * length);
	// FIXME: I have no idea what I'm doing here.
	//        Can I index these guys?
	$("#search-results-table tbody tr").each(function(index) {
		if (index == randomSelection) {
			block += "song_id=" + $(".search-results-entry-song-id",this).text() + ";";
		}
	});
	var command = "?mode=vote;";
	$.getJSON(
			jsonSource + command + block,
			function(data){handlePlayerStateRequest(data);}
	);
}

function clearQueue() {
	block = "";
	$("#queue-list .queue-song").each(function(index) {
		block += "song_id=" + $(".queue-song-id",this).text() + ";";
	});
	var command = "?mode=unvote;";
	$.getJSON(
			jsonSource + command + block,
			function(data){handlePlayerStateRequest(data);}
	);
}

function handlePlayerStateRequest(json) {
	// volume
	if (json.player && json.player.volume != undefined) {
		volume = parseInt(json.player.volume);
		$("#controls-volume").html((volume / 10) + 1);
	} else {
		$("#controls-volume").html("-");
	}

	// user
	if (json.who) {
		$("#header-bar-user-message").html("logged in as");
		$("#user-name").html(json.who);
		currentUser = json.who;
	}

	// players
	if (json.players.length > 1) {
		$("#header-bar-menu-players-dropdown li").remove();
		for (i in json.players) {
			if (json.players[i] == json.selected_player) {
				$("#header-bar-menu-players-dropdown").append("<li><b><a href=\"javascript:changePlayer('" + json.players[i] + "');\">" + json.players[i] + "</a></b></li>\n");
			} else {
				$("#header-bar-menu-players-dropdown").append("<li><a href=\"javascript:changePlayer('" + json.players[i] + "');\">" + json.players[i] + "</a></li>\n");

			}
		}
	} else {
		$("#header-bar-menu-players").hide();
	}

	// now playing
	var nowPlaying = json.now_playing;
	var nowPlayingPanel = templates.nowPlayingPanel.clone();
	$("#now-playing-panel").empty();
	if (nowPlaying) {
		$("#now-playing-title a", nowPlayingPanel).html(nowPlaying.title);
		$("#now-playing-title a", nowPlayingPanel).attr('href',
			'#SongDetails/' + nowPlaying.song_id);
		$("#now-playing-title a", nowPlayingPanel).attr('title',
			nowPlaying.title);
		$("#now-playing-artist a", nowPlayingPanel).html(nowPlaying.artist);
		$("#now-playing-artist a", nowPlayingPanel).attr('href',
			'#SelectRequest/artist/' + uriencode(nowPlaying.artist));
		$("#now-playing-artist a", nowPlayingPanel).attr('title',
			nowPlaying.artist);
		$("#now-playing-album a", nowPlayingPanel).html(nowPlaying.album);
		$("#now-playing-album a", nowPlayingPanel).attr('href',
			'#SelectRequest/album/' + uriencode(nowPlaying.album));
		$("#now-playing-album a", nowPlayingPanel).attr('title',
			nowPlaying.album);
		$("#now-playing-total", nowPlayingPanel).html(readableTime(nowPlaying.length));
		totalTime = nowPlaying.length;
		startPlayingTimer();
		elapsedTime = Math.round(((new Date().getTime())/1000)) - json.player.song_start;
		// kludge to prevent time from going too high
		if (elapsedTime <= totalTime) {
			$("#now-playing-time", nowPlayingPanel).html(readableTime(elapsedTime));
		} else {
			$("#now-playing-time", nowPlayingPanel).html(readableTime(totalTime));
		}
		$("#nothing-playing-info", nowPlayingPanel).remove();
		$("#now-playing-panel").replaceWith(nowPlayingPanel);
		$("#now-playing-album-art-img").reflect({height: 16});
		$("#now-playing-progress").progressbar({value: Math.floor(100 * (elapsedTime/totalTime))});
	} else {
		$("#now-playing-album-art", nowPlayingPanel).remove();
		$("#now-playing-info", nowPlayingPanel).remove();
		$("#now-playing-panel").replaceWith(nowPlayingPanel);
		totalTime = -1;
	}

	if (!queueLocked) {
		// the queue
		$("#queue-list").empty();
		var total_length = 0;
		for (var i in json.playlist) {
			var song = json.playlist[i];
			var entry = templates.queueSong.clone();
			$(".queue-song-id", entry).html(song.song_id);
			$(".queue-song-title a", entry).html(titleOrPath(song));
			$(".queue-song-title a", entry).attr('href',
				'#SongDetails/' + song.song_id);

			$(".queue-song-artist a", entry).html(song.artist);
			$(".queue-song-artist a", entry).attr('href',
				'#SelectRequest/artist/' + uriencode(song.artist));

			$(".queue-song-time", entry).html(readableTime(song.length));
			if (_.indexOf(song.who, currentUser) != -1) {
				$(".queue-song-vote-link", entry).remove();
				$(".queue-song-unvote-link", entry).attr("href",
						"javascript:unvoteSong("+ song.song_id +")");
				$("div",entry).addClass("queue-song-voted");
			} else {
				$(".queue-song-vote-link", entry).attr("href",
						"javascript:voteSong("+ song.song_id +")");
				$(".queue-song-unvote-link", entry).remove();
			}
			$(".queue-song-vote-count", entry).html(song.who.length);
			total_length += parseInt(song.length);
			entry.appendTo("#queue-list");
		}
		var length = $("#queue-list").contents().length;
		if (length == 1) {
			$("#queue-song-count").html("One song");
		} else {
			$("#queue-song-count").html(length + " songs");
		}
		$("#queue-length").html(readableTime(total_length));
	}
}

function login() {
	$.get(
		'www-data/auth',
		function () {playerStateRequest();}
	);
}

function controlPlayPause() {
	$.getJSON(
			jsonSource + '?mode=start',
		function (data) {handlePlayerStateRequest(data);}
	);
}

function controlStop() {
	$.getJSON(
		jsonSource + '?mode=stop',
		function (data) {handlePlayerStateRequest(data);}
	);
}

function controlNext() {
	$.getJSON(
		jsonSource + '?mode=skip',
		function (data) {handlePlayerStateRequest(data);}
	);
}

function expandSplitDropdown(field) {
	if ($("label",field.parentNode).hasClass("expanded")) {
		$("label",field.parentNode).removeClass("expanded");
	} else {
		$("label",field.parentNode).addClass("expanded");
	}
}

function controlVolumeDown() {
	if (volume != undefined) {
		volume -= 10;
		$.getJSON(
			jsonSource + '?mode=volume;value=' + volume,
			function (data) {handlePlayerStateRequest(data);}
		);
	}
}

function controlVolumeUp() {
	if (volume != undefined) {
		volume += 10;
		$.getJSON(
			jsonSource + '?mode=volume;value=' + volume,
			function (data) {handlePlayerStateRequest(data);}
		);
	}
}

function toggleAdvancedSearch() {
	$("#search-results-advanced-container").slideToggle();
}

function songDetails(id) {
	$.getJSON(
		jsonSource + '?mode=get_details;song_id='+id,
		function(json) {
			json = json.song;
			$("#song-details-title a").html(json.title);
			$("#song-details-title a").attr('title', json.title);
			$("#song-details-title a").attr('href',
				'#SelectRequest/title/' + uriencode(json.title));

			$("#song-details-artist a").html(json.artist);
			$("#song-details-artist a").attr('title', json.artist);
			$("#song-details-artist a").attr('href',
				'#SelectRequest/artist/' + uriencode(json.artist));

			$("#song-details-album a").html(json.album);
			$("#song-details-album a").attr('title', json.album);
			$("#song-details-album a").attr('href',
				'#SelectRequest/album/' + uriencode(json.album));

			$("#song-details-file a").html(json.path);
			$("#song-details-file a").attr('title', json.path);
			$("#song-details-file a").attr('href',
				'#SelectRequest/path/' + uriencode(json.path));
			$("#search-results-song-details").show(300, function() {
				$("#song-details-album-art-img").reflect({height: 32});
			});
			if (json.who.length > 0) {
				$("#song-details-voters").html(htmlForVoters(json.who));
			} else {
				$("#song-details-voters").html("");
			}
		}
	);
}

function htmlForVoters(who) {
	var output = "Voters: ";
	for (voter in who) {
		output += who[voter];
		if (voter < who.length - 1) {
			output += ", ";
		}
	}
	return output;
}

function hideSongDetails() {
	$("#search-results-song-details").hide(300);
}

$("#messageBox").ready(function() {
	$("#messageBox").dialog({
		autoOpen: false,
		modal: true,
		buttons: {"ok": function() {
			$(this).dialog("close");
			// set the text back to default
			// (so we know if someone forgot to set it in another call)
			$(this).html("no text... why?");
		}}
	});

	$("#messageBox").ajaxError(function (e, xhr, opts, err) {
		$(this).dialog('option', 'title', 'Communication Error');
		$(this).html(xhr.responseText);
		$(this).dialog('open');
	});
});

function advancedSearchFormSubmit() {
	var conditions = [];
	var inner = [];
	$(".advanced-search-row").each(function(index) {
		// TODO: check if this is an OR row instead
		// if (this_is_OR_row) {
		// conditions.push(inner.join('/AND/'));
		// inner = [];
		// etc
		// }

		inner.push($(".adv-search-type input:checked", this).val()
			+ "/" + $(".adv-search-compare input:checked", this).val()
			+ "/" + uriencode($(".adv-search-value", this).val()));
	});
	conditions.push(inner.join('/AND/')); // handle the last one
	alert(conditions.join('/OR/'));
	return false;
}

function formSearch() {
	$.address.value("SearchRequest/any/" + formencode($("#search-box").val()));
	return false;
}

function uriencode(str) {
	str = str.replace(/\&/g, '%26');
	str = str.replace(/\+/g, '%2b');
	str = str.replace(/\#/g, '%23');
	str = str.replace(/\//g, '%2f');

	return encodeURIComponent(str);
}

function formencode(str) {
	str = str.replace(/\&/g, '%26');
	str = str.replace(/\+/g, '%2b');
	str = str.replace(/\#/g, '%23');
	str = str.replace(/\//g, '%2f');

	return str;
}

function pageLoadChange(hash) {
	hash = hash.replace(/^\//, '');
	var args = hash.split('/');
	var action = args.shift();
	if (!args[0]) args[0] = '';
	if (!args[1]) args[1] = '';
	hideSongDetails();
	if (action == '') {
		loadRandomSongs(20, (new Date()).getTime());
	} else if (action == 'RandomSongs') {
		loadRandomSongs(args[0], args[1]);
	} else if (action == 'RecentSongs') {
		loadRecentSongs(args[0]);
	} else if (action == 'PlayHistory') {
		loadPlayHistory(args[0], args[1]);
	} else if (action == 'SelectRequest') {
		selectRequest(args[0], args[1]);
	} else if (action == 'SearchRequest') {
		doSearch(args[0], args[1]);
	} else if (action == 'SongDetails') {
		songDetails(args[0]);
	}
	if (action == 'Statistics') {
		setLeftPanel("statistics");
		setMenuItem("statistics");
	} else if (action == 'Playlists') {
		setLeftPanel("search-results");
		setMenuItem("playlists");
	} else {
		setLeftPanel("search-results");
		setMenuItem("now-playing");
	}
}

function setLeftPanel(panel) {
	$(".panel-left").not("#"+panel).slideUp(300);
	$("#"+panel).slideDown(300);
}

function setMenuItem(item) {
	$("#header-bar-menu-list li a").not("#header-bar-menu-"+item).removeClass("header-bar-menu-selected", 100);
	$("#header-bar-menu-" + item).addClass("header-bar-menu-selected", 100);
}

$.address.change(function(e) {pageLoadChange(e.value);});
