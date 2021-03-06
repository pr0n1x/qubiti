'use strict';

const fs = require('fs')
	,Path = require('path')
	,convertSourceMap = require('convert-source-map')
	,vsource = require('vinyl-source-stream')
	,vbuffer = require('vinyl-buffer')
	,gutil = require('gulp-util')
	//,watchify = require('watchify')
	,plumber = require('gulp-plumber')
	,merge = require('merge-stream')
	,glob = require('glob')
	,browserify = require('browserify')
	,tap = require('gulp-tap')
	,sourcemaps = require('gulp-sourcemaps')
	,uglify = require('gulp-uglify-es').default
	,debug = require('gulp-debug')
	,rename = require('gulp-rename')
	,minimatch = require('minimatch')
	,utils = require('./utils')
;

class JsTools {
	constructor(gulp, conf, createBrowserSyncStream) {
		this.gulp = gulp;
		this.conf = conf;
		this.createBrowserSyncStream = (typeof createBrowserSyncStream === 'function')
			? createBrowserSyncStream : gutil.noop;
		this.bundles = {};
	}

	createBundler(src) {
		const conf = this.conf;
		const name = Path.basename(src)
			.replace(/^(?:_+|bundle\.)/, '')
			.replace(/\.(?:js|jsm|jsx|vue)$/, '');
		const filename = Path.basename(conf.js.bundle.dest)
			.replace( /\*/, name );
		const bfy = browserify({ entries: src },{
			debug: true
			,paths: conf.js.bundle.modules.map(path => conf.curDir+'/'+path)
		});
		const bundle = {
			bfy, src, name, filename,
			dest: Path.dirname(conf.js.bundle.dest),
			deps: []
		};
		bfy.pipeline.get('deps').push(tap(row => bundle.deps.push(row.file)));
		return bundle
	}

	createBundleStream(bundle) {
		const conf = this.conf;
		if(conf.verbose) gutil.log('started building js-bundle '+gutil.colors.blue('"'+bundle.name+'"'));
		this.bundles[bundle.name] = bundle;
		let stream = bundle.bfy.bundle()
			.on('error', utils.swallowError)
			.pipe(vsource(bundle.filename))
			.pipe(plumber())
			.pipe(vbuffer())
			.pipe(tap(() => {
				if (conf.verbose) gutil.log('js-bundle "'+bundle.name+'": '
					+gutil.colors.blue(bundle.src+' -> '+bundle.dest+Path.sep+bundle.filename));
			}))
			.pipe(this.externalizeBrowserifySourceMap(bundle.dest))
			.pipe(this.gulp.dest(bundle.dest));
		if( conf.assets.min_js || conf.dev_mode.minify_useless_js ) {
			stream = this.addMinificationToJsStream(stream, Path.dirname(conf.js.bundle.dest))
		}
		else if(conf.verbose) {
			stream = stream.pipe(tap(() => gutil.log(
				gutil.colors.gray('skipping minify', bundle.filename)
				+gutil.colors.gray(' (checkout --production option)')
			)));
		}
		return stream.pipe(this.createBrowserSyncStream());
	}

	/**
	 * Выделяем встроенный sourcemap browserify в отдельный файл
	 * Этот обработчик передается в .pipe(tap(...))
	 * https://github.com/thlorenz/exorcist
	 * https://github.com/thlorenz/convert-source-map
	 *
	 * Ещё можно попробовать это https://www.npmjs.com/package/gulp-extract-sourcemap
	 * ну... да пускай будет как есть.
	 *
	 * @param bundleDir
	 * @returns {Function}
	 */
	externalizeBrowserifySourceMap(bundleDir) {
		const conf = this.conf;
		return tap(function(file) {
			let mapFileName = Path.basename(file.path)+'.map';
			let mapFilePath = conf.curDir+'/'+bundleDir+'/'+mapFileName;
			let src = file.contents.toString();
			let converter = convertSourceMap.fromSource(src);
			converter.sourcemap.sourceRoot = Path.relative('/'+bundleDir, '/');
			fs.writeFileSync(
				mapFilePath,
				converter
					.toJSON()
					.replace(new RegExp(''+conf.curDir+'/', 'gim'), '../')
					.replace(new RegExp('"js/([a-zA-Z0-9\\-_.]+)/', 'gim'), '"../js/$1/')
					.replace(/\r\n/g, '\n')
					.replace(/\\r\\n/g, '\\n')
			);
			let content = convertSourceMap.removeComments(src).trim()
				+ '\n//# sourceMappingURL=' + Path.basename(mapFilePath);
			file.contents = Buffer.from(content, 'utf8');
		});
	}

	addMinificationToJsStream(stream, dest, debugTitle) {
		const conf = this.conf;
		let verboseMode = true;
		if( 'string' != typeof(debugTitle) || '' === debugTitle ) {
			verboseMode = false;
		}
		return stream
			.pipe(plumber())
			.pipe(sourcemaps.init({loadMaps: true}))
			.pipe(uglify())
			.pipe(verboseMode ? debug({title: debugTitle}) : gutil.noop())
			.pipe(rename({extname: '.min.js'}))
			.pipe(sourcemaps.write('.', {
				includeContent: false,
				mapSources: utils.fixMapSources(dest)
			}))
			.pipe(this.gulp.dest(dest));
	}

	buildJsBundles() {
		const streams = merge();
		const conf = this.conf;
		const srcList = (typeof conf.js.bundle.src == 'string')
			? [conf.js.bundle.src] : conf.js.bundle.src;
		srcList.forEach((src) => {
			glob.sync(src).forEach((file) => {
				if (gutil.env['filter']
					&& gutil.env['filter'] !== Path.basename(file).replace(/\.(?:js|jsm|jsx|vue)$/, '')
					&& !minimatch(file, gutil.env['filter'])
				) {
					gutil.log(gutil.colors.gray('Filtered/skipped bundle:')+' '+gutil.colors.blue(file));
					return;
				}
				streams.add(this.createBundleStream(this.createBundler(file)));
			});
		});
		// noinspection JSUnresolvedFunction
		return streams
			.on('end', function() {
				//onsole.log('js-bundle-test END');
			})
			.on('error', function(err) {
				gutil.log('Error:', err);
			});
	}
}

module.exports = JsTools;
