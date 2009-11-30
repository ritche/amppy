package Acoustics::RPC::Remctl;

use strict;
use warnings;

use Log::Log4perl ':easy';

sub start {
	my $class     = shift;
	my $acoustics = shift;

	$class->do_call($acoustics, 'start');
}

sub skip {
	my $class     = shift;
	my $acoustics = shift;

	$class->do_call($acoustics, 'skip');
}

sub stop {
	my $class     = shift;
	my $acoustics = shift;

	$class->do_call($acoustics, 'stop');
}

sub do_call {
	my $class     = shift;
	my $acoustics = shift;
	my $action    = shift;

	for (qw(user host)) {
		die "Config entry {rpc}{$_} not defined"
			unless $acoustics->config->{rpc}{$_};
	}

	system(
		'remctl',
		$acoustics->config->{rpc}{host},
		'acoustics',
		$action,
	) == 0 or die "couldn't run ssh: $!,$?,@{[$? >> 8]}";
}

1;