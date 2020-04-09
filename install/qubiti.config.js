'use strict';
module.exports = {
	precss: {
		lang: 'less' // less | scss
	},
	browserSync: {
		proxyLamp: 'default.loc'
	},
	dev_mode: {
		// В dev_mode (conf.production == false)
		// вместо bundle.css файла
		// используются отдельные файлы css-bundle-а
		// подключенные непосредственно в html-е.
		// Соответственно:

		// можно не синхронизировать в browser-sync
		// файл bundle[.min].css
		// опция в консоли: --dev-no-bsync-css-bundle-file
		no_bsync_css_bundle_file: false,
		// Вообще не собирать файл bundle[.min].css
		// Но после окончания работ надо не забывать собрать бандл руками
		// опция в консоли: --dev-no-build-css-bundle-file
		no_build_css_bundle_file: false
	},
	js: {
		vendor: {
			shim: {

			}
		}
	}
};
