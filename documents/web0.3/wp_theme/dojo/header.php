<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head profile="http://gmpg.org/xfn/11">
	<meta http-equiv="Content-Type" content="<?php bloginfo('html_type'); ?>; charset=<?php bloginfo('charset'); ?>" />
	<title><?php bloginfo('name'); ?> <?php wp_title(); ?></title>
	<meta name="generator" content="WordPress <?php bloginfo('version'); ?>" /> <!-- leave this for stats -->
	<link rel="stylesheet" href="http://dojotoolkit.org/css/common.css" type="text/css" />
	<link rel="stylesheet" href="http://dojotoolkit.org/css/text.css" type="text/css" />
	<link rel="stylesheet" href="<?php bloginfo('stylesheet_url'); ?>" type="text/css" media="screen" />
	<link rel="alternate" type="application/rss+xml" title="RSS" href="<?php bloginfo('rss2_url'); ?>" />
	<link rel="alternate" type="application/atom+xml" title="Atom" href="<?php bloginfo('atom_url'); ?>" />
	<link rel="pingback" href="<?php bloginfo('pingback_url'); ?>" />
	<?php wp_get_archives('type=monthly&format=link'); ?>
	<?php wp_head(); ?>
</head>
<body>
	<div id="foundation-header">
		<div id="foundation-logo">
			<a href="http://dojotoolkit.org/">The Dojo Toolkit home page</a>
		</div>
		<div id="foundation-about">
			<a href="http://dojotoolkit.org/foundation/">About the Dojo Foundation</a>
		</div>
	</div>
	<div id="header">
		<h1 id="logo">Dojo, the Javascript Toolkit</h1>
	</div>
	<div class="body">
