#!/usr/bin/env perl

use strict;
use warnings;
use lib ($0 =~ m{(.+)/})[0] . '/../lib';
use Acoustics;
use Log::Log4perl ':easy';
use IPC::Open2 'open2';

my $acoustics = Acoustics->new({
	config_file => ($0 =~ m{(.+)/})[0] . '/../lib/acoustics.ini',
});

$acoustics->add_player({local_id => $$});

$SIG{TERM} = $SIG{INT} = sub {
	WARN "Exiting player $$";
	$acoustics->remove_player;
	exit;
};
$SIG{HUP} = 'IGNORE';
$SIG{CHLD} = 'IGNORE';

while(1)
{

	my @songs = $acoustics->get_playlist;
	@songs    = $acoustics->get_song({}, 'RANDOM()', 1) unless @songs;
	my %data  = %{$songs[0]};

	$acoustics->delete_vote({song_id => $data{song_id}});

	if(-e $data{path})
	{
		$acoustics->add_playhistory(\%data);
		$acoustics->update_player({song_id => $data{song_id}});
		INFO "Playing '$data{path}'";
		INFO "$data{title} by $data{artist} from $data{album}";

		# General plan: open both input and output of the mplayer process
		# then continually read from input so we know it's still running
		# and handle SIGHUP. don't use waitpid because it blocks SIGHUP.
		my $pid = open2(my $child_out, my $child_in,
			'mplayer', '-slave', '-quiet', $data{path})
			or LOGDIE "couldn't open mplayer: $!";

		# when we get SIGHUP, ask mplayer to quit
		local $SIG{HUP} = sub {
			WARN "skipping song: $data{path}!";
			print $child_in "quit\n";
		};

		local $SIG{TERM} = $SIG{INT} = sub {
			WARN "Exiting player $$";
			print $child_in "quit\n";
			$acoustics->remove_player;
			exit;
		};

		# loop until mplayer ends
		while (<$child_out>) {}

		close $child_out; close $child_in;
	}
	else
	{
		ERROR "Song '$data{path}' is invalid, deleting";
		$acoustics->delete_song({song_id => $data{song_id}});
	}
}