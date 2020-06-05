'use strict';

const
	 EventEmitter = require('events').EventEmitter
	,decodeKeypress = require('decode-keypress')
	,gutil = require('gulp-util');

class KeyPressEmitter extends EventEmitter {

	// keyAlt = '\u001b';
	// key_w = '\u0017';
	// // sequences tested in linux
	// sequence_ctrl_alt_w = keyAlt+key_w;
	// sequence_ctrl_r = '\u0012';
	// sequence_ctrl_l = '\t';
	// sequence_ctrl_s = '\u0013';

	constructor() {
		super();
		this._debug = false;
	}

	start() {
		// process.stdin.setEncoding('utf8');
		// process.stdin.setEncoding('ascii');
		process.stdin.setRawMode(true);
		process.stdin.on('data', this.onData.bind(this));
	}

	onData(data) {
		/**
		 * @typedef {Object} DecodedKey
		 * @property {string} name
		 * @property {string} sequence
		 * @property {boolean} shift
		 * @property {boolean} meta
		 * @property {boolean} ctrl
		 */
		/**
		 * @type {DecodedKey}
		 */
		const key = decodeKeypress(data);

		if( ( key.shift === false && key.name === 'q')
			|| (key.ctrl && key.name === 'c')
		) {
			process.exit();
		}
		if (this.debug) {
			console.log('decode keypress\n', key);
		}
		else if( key.sequence === '\r' ) {
			console.log();
		}

		if (key.name === 'f1' && key.shift === false
			&& key.ctrl === false && key.meta === false
		) {
			gutil.log('Hot key [F1]: Show hot keys help');
			this.emit('showHotKeysHelp');
		}
		else if (key.name === 'f2' && key.shift === false
			&& key.ctrl === false && key.meta === false
		) {
			gutil.log('Hot key [F2]: Show help');
			this.emit('showHelp');
		}
		else if (key.shift === true && key.name === 'w') {
			gutil.log('Hot key [Shift+w]: Remove watchers');
			this.emit('removeWatchers');
		}
		else if (key.shift === false && key.name === 'w') {
			gutil.log('Hot key [w]: Reload watchers');
			this.emit('reloadWatchers');
		}
		else if (key.shift === false && key.name === 'h') {
			gutil.log('Hot key [h]: Build html');
			this.emit('buildHtml');
		}
		else if ('s' === key.name && key.shift === true) {
			gutil.log('Hot key [Shift+s]: Build main styles and bundle');
			this.emit('buildMainStylesAndBundle');
		}
		else if ('s' === key.name && key.shift === false) {
			gutil.log('Hot key [s]: Build main styles (w/o -bundle)');
			this.emit('buildMainStyles');
		}
		else if ('a' === key.name && key.shift === true) {
			gutil.log('Hot key [Shift+a]: Build all styles (main + bundle + components)');
			this.emit('buildAllStylesAndBundle');
		}
		else if ('a' === key.name && key.shift === false) {
			gutil.log('Hot key [a]: Build all styles (main + components)');
			this.emit('buildAllStyles');
		}
		else if ('k' === key.name && key.shift === false) {
			gutil.log('Hot key [k]: Build only bundle of main styles');
			this.emit('buildCssBundle');
		}
		else if ('l' === key.name && key.shift === false) {
			gutil.log('Hot key [l]: Build component styles');
			this.emit('buildComponentStyles');
		}
		else if ('j' === key.name && 'j' === key.sequence && key.shift === false) {
			gutil.log('Hot key [j]: Build js-bundles');
			this.emit('buildJsBundle');
		}
		else if ('j' === key.name && 'J' === key.sequence && key.shift === true) {
			gutil.log('Hot key [Shift+j]: Build js-scripts (w/o bundles)');
			this.emit('buildJsScripts');
		}
		else if ('j' === key.name && '\u001bj' === key.sequence
			&& key.shift === false && key.meta === true
		) {
			gutil.log('Hot key [Alt+j]: Build js-scripts and all bundles');
			this.emit('buildJs');
		}
		else if ('u' === key.name && 'u' === key.sequence && key.shift === false) {
			gutil.log('Hot key [u]: Build sprites');
			this.emit('buildSprites');
		}
		else if ('i' === key.name && key.shift === false && key.meta === false) {
			gutil.log('Hot key [i]: Optimize all images');
			this.emit('optimizeImages');
		}
		else if ('i' === key.name && '\u001bi' === key.sequence
			&& key.shift === false && key.meta === true
		) {
			gutil.log('Hot key [Alt+i]: Optimize common images');
			this.emit('optimizeCommonImages')
		}
		else if ('i' === key.name && 'I' === key.sequence
			&& key.shift === true && key.meta === false
		) {
			gutil.log('Hot key [Shift+i]: Optimize component images');
			this.emit('optimizeComponentImages')
		}
		else if ('f' === key.name && key.shift === false) {
			gutil.log('Hot key [f]: Build csv-icons-font');
			this.emit('buildCsvIconsFont');
		}
		else if ('g' === key.name && key.shift === false) {
			gutil.log('Hot key [g]: Download goole-web-fonts');
			this.emit('downloadGoogleWebFonts');
		}
		else if ('d' === key.name && 'D' === key.sequence && key.shift === true) {
			gutil.log('Hot key [Shift+d]: Switch debug mode');
			this.emit('switchDebugMode');
		}
		else if ('p' === key.name && 'P' === key.sequence && key.shift === true) {
			gutil.log('Hot key [Shift+p]: Switch production mode');
			this.emit('switchProductionMode');
		}
		else if ('r' === key.name && key.shift === false) {
			gutil.log('Hot key [r]: Reload components');
			this.emit('reloadAll');
		}
		else if ('b' === key.name && key.shift === false) {
			gutil.log('Hot key [b]: Full build');
			this.emit('build');
		}
		// TODO: Дописать запуск разных задач, которые отсутствуют в watcher-ах типа спрайтов, картинок и пр.
	}

	set debug(value) {
		this._debug = !!value;
	}
	get debug() {
		return this._debug;
	}
}

module.exports = KeyPressEmitter;
