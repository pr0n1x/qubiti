'use strict';
module.exports = {
	verbose: true,
	production: false,
	precss: {
		lang: 'less' // less | scss
	},
	browser_sync: {
		proxy_lamp: {
			host: 'default.loc',
			port: 8008
		}
	},
	dev_mode: {
		// В dev_mode (conf.production == false)
		// если вместо bundle.css файла
		// используются отдельные файлы css-bundle-а
		// подключенные непосредственно в html-е.
		// Соответственно:
		// можно не синхронизировать в browser-sync
		// файл bundle[.min].css
		// опция в консоли: --dev-no-bsync-css-bundle-file
		no_bsync_css_bundle_file: false,
		// Вообще не собирать файл bundle[.min].css
		// Но после окончания работ надо не забывать собрать bundle.css руками
		// опция в консоли: --dev-no-build-css-bundle-file
		no_build_css_bundle_file: false
	}
	// uncomment to use some charset instead UTF-8
	//,html: {charset: 'windows-1251'}

};
