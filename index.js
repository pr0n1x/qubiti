'use strict';
/**
 * Сборщик верстки для шаблонов Битрикс
 *
 * известные баги:
 * 1. Если в компонентах нет ни одного файла style.(less|scss), то таск по сборке стилей будет падать
 * 2. Если вести разработку в production-режиме, то hot-reload в браузере стилей будет
 *    отставать от реального состояния кода на один шаг. Одно сохранение. Связано это со сборкой css-bundle-файла.
 * 3. js-vendor-bundle упадет если не создана папка js
 */

module.exports = function(currentTemplateDir) {

/** @const */
const
	os = require('os')
	,fs = require('fs')
	//,glob = require('glob')
	,extend = require('extend')
	,Path = require('path')
	,gulp = require('gulp')
	,EventEmitter = require('events').EventEmitter
	,decodeKeypress = require('decode-keypress')
	,concat = require('gulp-concat')
	,postcss = require('gulp-postcss')
	,autoprefixer = require('autoprefixer')
	,cssnano = require('cssnano')
	,debug = require('gulp-debug')
	,filter = require('gulp-filter')
	,googleWebFonts = require('gulp-google-webfonts')
	,helpDoc = require('gulp-help-doc')
	,iconfont = require('gulp-iconfont')
	,iconfontCss = require('gulp-iconfont-css')
	,imagemin = require('gulp-imagemin')
	,svg2z = require('gulp-svg2z')
	,less = require('gulp-less')
	,sass = require('gulp-sass')
	,nunjucksRender = require('gulp-nunjucks-render')
	,nunjucksIncludeData = require('nunjucks-includeData')
	,plumber = require('gulp-plumber')
	,sourcemaps = require('gulp-sourcemaps')
	,tap = require('gulp-tap')
	,gutil = require('gulp-util')
	,spritesmith = require('gulp.spritesmith')
	,merge = require('merge-stream')
	,runSequence = require('run-sequence').use(gulp)
	,vbuffer = require('vinyl-buffer')
	,vsource = require('vinyl-source-stream')
	,minimatch = require('minimatch')
	,rename = require('gulp-rename')
	,ttf2eot = require('gulp-ttf2eot')
	,ttf2woff = require('gulp-ttf2woff')
	,ttf2woff2 = require('gulp-ttf2woff2')
	,through2 = require('through2')
	// ,nodeSassTildeImporter = require('node-sass-tilde-importer')
	,nodeSassTildeImporter = require('./src/nodeSassTildeImporter')

	,utils = require('./src/utils')
	,NunjucksBitrix = require('./src/NunjucksBitrix')
	,JsTools = require('./src/JsTools')
;

const browserSyncEmitter = new EventEmitter();
let browserSync = require('browser-sync').create(null, browserSyncEmitter);
let isInteractiveMode = false;

let conf = {
	//noinspection JSUnresolvedVariable
	curDir: currentTemplateDir
	,debug: false
	,production: false
	,assets: {
		// Использовать минифицированные css-файлы
		min_css: false, // getter от ключа .production
		// Использовать минифицированные js-файлы
		min_js: false // getter от ключа .production
	}
	,dev_mode: {
		// .dev_mode.minify_useless_css определяет пересобирать ли min-файлы
		// если .assets.min_css == false, то и минифицировать по идее не нужно.
		// Минификаия - это тяжелая операция, которая сэкономить
		// много времени на сборке в режиме разработки.
		// Ниже эти параметры определены как ф-ия (getter) от ключа .production
		// .dev_mode.minify_useless_css = produiction ? true : false
		// Если эти параметры определить в файле "qubiti.config.js",
		// то они всегда будут иметь значение указанное там
		// вне зависимости от значения ключа .production.
		minify_useless_css: false,
		// то же что и .dev_mode.minify_useless_css только для js-файлов
		minify_useless_js: false,

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
		no_build_css_bundle_file: false,

		// Иногда разумно использовать такие плагины browserify
		// как hmr и/или watchify, соответственно для избежания всяких гонок,
		// даем возможность вырубить gulp-watcher для js-bundle-ов.
		// Да и вообще hmr и watchify для сборки именно js-bunlde-ов
		// будут в разы (если не в 10-ки раз) быстрее.
		js_bundle_no_watching: false
	}
	,browserSync: {
		server: './'
		,index: '/index.html'
		,open: false
		,proxyLamp: 'default.loc'
	}
	,html: {
		base: 'sources/html'
		,pages: [
			'@base/**/*.njk'
			,'!@base/**/_*{,/*,/**/*}.njk'
		]
		,components: [
			 'components/*/*/{*,.*}/**/*.njk'
			,'components/*/*/{*,.*}/*/*/{*,.*}/**/*.njk'
		]
		,watch: [
			 '@base/**/*.njk'
			,'@base/**/*.json'

			,'components/*/*/{*,.*}/**/*.njk'
			,'components/*/*/{*,.*}/**/*.json'
			,'components/*/*/{*,.*}/*/*/{*,.*}/**/*.njk'
			,'components/*/*/{*,.*}/*/*/{*,.*}/**/*.json'
		]
		,dest: 'html'
		,bx_component: {
			 use_minified_js: false
			,use_minified_css: false
			,debug_show_component_files: !!gutil.env['dbg-show-bx-component-files']
			,debug_assets: !!gutil.env['dbg-bx-assets']
		}
	}
	,precss: {
		lang: 'less', // can be "less" or "scss"
		main: {
			 base: 'sources/@lang'
			,dest: 'css'
			,bundle: '@base/_bundle.css'
			,files: [
				'@base/**/*.@lang'

				// Исключаем файлы и папки начинающие с подчеркивания.
				//    Будем применять их для импортируемых файлов
				//    без возможности автономной компиляции
				,'!@base/**/_*{,/*,/**/*}.@lang'

				// Исключаем библиотеки миксинов
				,'!@base/**/mixin{,s}{,.*,-*}{,/*,/**/*}.@lang'
				,'!@base/**/lib{,s,rary{,s}}{,.*,-*}{,/*,/**/*}.@lang'

				// Исключаем файлы с переменными
				,'!@base/**/var{,s,iable{,s}}{,.*,-*}{,/*,/**/*}.@lang'

				// исключаем twitter bootstrap (но только подпапки))
				// файлы именыемые bootstrap*.less не исключаем
				// для возможности отдельной сборки
				,'!@base/**/bootstrap{,.*,-*}{/*,/**/*}.@lang'
			]
			,watchImports: [
				 // Это те файлы библиотек при которых пересобираем все целевые файлы
				 // смотри исключения в conf.precss.main.files
				 '@base/_*{,/*,/**/*}.@lang'
				,'@base/mixin{,s}{,.*,-*}{,/*,/**/*}.@lang'
				,'@base/lib{,s,rary{,s}}{,.*,-*}{,/*,/**/*}.@lang'
				,'@base/var{,s,iable{,s}}{,.*,-*}{,/*,/**/*}.@lang'
				,'@base/bootstrap{,.*,-*}{/*,/**/*}.@lang'
			]
		}
		,components: {
			 styleName: 'style.@lang'
			,files: [
				 'components/*/*/{*,.*}/@styleName'
				,'components/*/*/{*,.*}/*/*/{*,.*}/@styleName'
			]
			,watch: [
				 'components/*/*/**/*.@lang'
				,'components/*/*/{*,.*}/**/*.@lang'
				,'components/*/*/{*,.*}/*/*/{*,.*}/**/*.@lang'
			]
		}
	}
	,js: {
		bundle: {
			base: 'sources/js'
			,src: '@js_bundle_base/*.js'
			,dest: 'js/bundle.*.js'
			,watch: [
				 '@js_bundle_base/**/*.{js,vue,jsx,jsm}'
				,'!@js_bundle_base/{vendor,modules}/**/*.{js,vue,jsx,jsm}'
			]
			,modules: [
				 '@js_bundle_base/vendor'
				,'@js_bundle_base/modules'
				,'sources/vendor'
				,'sources/modules'
				,'node_modules'
			]
		}
		,scripts: [
			'js/**/*.js'
			// исключаем bundle-ы
			,'!js/bundle.*.js'
			// исключаем уже минифицированные файлы
			,'!js/**/*{.,-}{min,pack}.js'

			// Обрабатываем (минифицируем) js-файлы компонентов
			,'components/*/*/**.js'
			,'components/*/*/{*,.*}/**/*.js'
			,'components/*/*/{*,.*}/*/*/{*,.*}/**/*.js'

			// Исключаем уже собранные файлы и всякое для require
			,'!components/*/*/{*,.*}/*{.,-}min.js'
			,'!components/*/*/{*,.*}/*/*/{*,.*}/*{.,-}{min,pack}.js'
			,'!components/*/*/{*,.*}/vendor/**/*.js'
			,'!components/*/*/{*,.*}/*/*/{*,.*}/vendor/**/*.js'
			,'!components/*/*/{*,.*}/_*.js'
			,'!components/*/*/{*,.*}/_*/*.js'
			,'!components/*/*/{*,.*}/*/*/{*,.*}/_*/*.js'
		]
	}
	,images: {
		common: {
			src: [ 'sources/images/**/*.{jpeg,jpg,png,gif,ico,svg}', ]
			,dest: 'images'
		}
		,components: {
			src: [
				 'components/*/*/{*,.*}/img.src/**/*.{jpeg,jpg,png,gif,ico,svg}'
				,'components/*/*/{*,.*}/*/*/{*,.*}/img.src/**/*.{jpeg,jpg,png,gif,ico,svg}'
			]
			,srcFolder: 'img.src'
			,destFolder: 'images'
		}
		,png: { optimizationLevel: 3 }
		,jpeg: { quality: 75, progressive: true }
		,gifscale: { interlaced: true }
		,svgo: { removeViewBox: true }
		,svgz: true
	}
	,sprites: {
		src: 'sprites'
		,imgUrl: '../images/sprites'
		,minify: true
		,dest: {
			img: 'sources/sprites',
			less: 'sources/less/vars/sprites',
			lessMixins: 'sources/less/mixins/sprites.less'
		}
	}
	,webFonts: {
		src: [
			'sources/fonts/**/*.ttf'
			,'!sources/fonts/**/_*{,/*,/**/*}.ttf'
		],
		dest: 'fonts'
	}
	,googleWebFonts: {
		fontsList: 'sources/google-web-fonts.list' // relative to the site template root
		,fontsDir: '../fonts/gwf/' // fontsDir is relative to dest
		,cssDir: 'lib/' // cssDir is relative to dest
		,cssFilename: 'google-web-fonts.css'
		,dest: './@precss_base/'
	}
	,svgIconFont: {
		src: [
			'sources/svgiconsfont/**/*.svg'
			,'!sources/svgiconsfont/**/_*/*{,/*,/**/*}.svg'
		]
		,formats: ['woff2', 'woff', 'ttf', 'eot', 'svg']
		,template: 'sources/svgiconsfont/_@precss_lang.tmpl'
		// result path is relative to dest folder i.e. fonts/svgicons in this case
		,result: '../../@precss_base/mixins/svgicons.@precss_lang'
		,fontName: 'svgicons'
		,cssClass: 'sif'
		,dest: 'fonts/svgicons'
	}
};


function isProduction() {
	return !!conf.production;
}
Object.defineProperty(conf.dev_mode, 'minify_useless_css', utils.defineReferenceProperty(isProduction));
Object.defineProperty(conf.dev_mode, 'minify_useless_js', utils.defineReferenceProperty(isProduction));
Object.defineProperty(conf.assets, 'min_css', utils.defineReferenceProperty(isProduction));
Object.defineProperty(conf.assets, 'min_js', utils.defineReferenceProperty(isProduction));
Object.defineProperty(conf.html.bx_component, 'use_minified_css', utils.defineReferenceProperty(isProduction));
Object.defineProperty(conf.html.bx_component, 'use_minified_js', utils.defineReferenceProperty(isProduction));

let userConf = require(conf.curDir+'/qubiti.config.js');
if( typeof(userConf) == 'function' ) {
	extend(true, conf, userConf(conf));
}
else {
	extend(true, conf, userConf);
}

utils.dereferencePlaceHolder(conf.html, /@base/, conf.html.base);
utils.dereferencePlaceHolder(conf.precss, /@lang/, conf.precss.lang);
utils.dereferencePlaceHolder(conf.precss.main, /@base/, conf.precss.main.base);
utils.dereferencePlaceHolder(conf.precss.components.files, /@styleName/, conf.precss.components.styleName);
utils.dereferencePlaceHolder(conf.googleWebFonts.dest, /@precss_base/, conf.precss.main.base);
utils.dereferencePlaceHolder(conf.svgIconFont, /@precss_lang/, conf.precss.lang);
utils.dereferencePlaceHolder(conf.svgIconFont, /@precss_base/, conf.precss.main.base);
utils.dereferencePlaceHolder(conf.js.bundle, /@js_bundle_base/, conf.js.bundle.base);

// noinspection JSUnresolvedVariable
conf.debug = !!(gutil.env.dbg ? true : conf.debug);
conf.production = !!(gutil.env.production ? true : conf.production);
if (gutil.env['optipng-level'] !== undefined) {
	conf.images.png.optimizationLevel = gutil.env['optipng-level'];
}

if( typeof(gutil.env['assets-min']) != 'undefined' ) {
	let isAllAssetsIsMinified = utils.parseArgAsBool(gutil.env['assets-min']);
	conf.assets.min_css = isAllAssetsIsMinified;
	conf.assets.min_js = isAllAssetsIsMinified;
	conf.html.bx_component.use_minified_css = isAllAssetsIsMinified;
	conf.html.bx_component.use_minified_js = isAllAssetsIsMinified;
}
if( typeof(gutil.env['assets-min-css']) != 'undefined' ) {
	conf.assets.min_css = utils.parseArgAsBool(gutil.env['assets-min-css']);
	conf.html.bx_component.use_minified_css = conf.assets.min_css;
}
if( typeof(gutil.env['assets-min-js']) != 'undefined' ) {
	conf.assets.min_js = utils.parseArgAsBool(gutil.env['assets-min-js']);
	conf.html.bx_component.use_minified_js = conf.assets.min_js;
}

if( typeof(gutil.env['dev-no-bsync-css-bundle-file']) != 'undefined' ) {
	conf.dev_mode.no_bsync_css_bundle_file = utils.parseArgAsBool(gutil.env['dev-no-bsync-css-bundle-file']);
}
if( typeof(gutil.env['dev-no-build-css-bundle-file']) != 'undefined' ) {
	conf.dev_mode.no_build_css_bundle_file = utils.parseArgAsBool(gutil.env['dev-no-build-css-bundle-file']);
}

if( typeof(gutil.env['js-bundle-no-watching']) != 'undefined' ) {
	conf.dev_mode.js_bundle_no_watching = utils.parseArgAsBool(gutil.env['js-bundle-no-watching']);
}


const jsTools = new JsTools(gulp, conf, createBrowserSyncStream);


let browserSyncTimeout = 0;
// noinspection JSUnusedLocalSymbols
function onTaskEndBrowserReload() {
	clearTimeout(browserSyncTimeout);
	browserSyncTimeout = setTimeout(browserSync.reload, 200);
}

function getRelFilePath(filePath) {
	return utils.getRelFilePath(filePath, conf.curDir);
}

let browserSyncReloadIsActive = true;
function switchBrowserSync(state) {
	if( state instanceof Boolean ) {
		browserSyncReloadIsActive = state;
	}
	else {
		browserSyncReloadIsActive = !browserSyncReloadIsActive;
	}
}
function createBrowserSyncStream() {
	return browserSyncReloadIsActive
		? browserSync.stream()
		: gutil.noop()
}

function reloadBrowserSync(done) {
	if( browserSyncReloadIsActive ) {
		if( typeof(done) == 'function' ) {
			//util.log(gutil.colors.red('browser-sync reload'));
			// noinspection JSUnusedLocalSymbols
			browserSyncEmitter.once('_browser:reload', function(event) {
				//util.log(gutil.colors.red('browser-sync event: _browser:reload'));
				setTimeout(function() {
					//util.log(gutil.colors.red('browser-sync event: _browser:reload - after 500ms'));
					done();
				}, 500);

			});
		}
		browserSync.reload();
	}
}

/**
 * Сборка less- или scss-файлов
 * @task {precss}
 * @order {3}
 */
function precss(opts, ...args) {
	if (typeof opts !== 'object') opts = {};
	if (conf.precss.lang === 'less') {
		return less(opts, ...args);
	} else if (conf.precss.lang === 'scss') {
		if (typeof opts.importer !== 'function') {
			opts.importer = nodeSassTildeImporter;
		}
		return sass(opts, ...args);
	}
	throw 'Incorrect css preprocessor language';
}
let cssBundleFiles = null;
//gulp.task('precss', ['precss-main-bundle', 'precss-components']);
// нет смысла запускать параллельно - нет прироста в скорости
// а последовательный запуск понятнее отлаживать при случае
gulp.task('precss', function(done) {
	runSequence('precss-main', 'precss-components', 'css-bundle', done);
});

gulp.task('precss-main', function() {
	return precssCommonPipe(
		gulp.src(conf.precss.main.files, {dot: true}),
		conf.precss.main.dest,
		conf.debug ? 'main precss:' : ''
	);
});
gulp.task('precss-main-bundle', function(done) {
	runSequence('precss-main', 'css-bundle', done);
});
gulp.task('precss-components', function() {
	return precssCommonPipe(
		gulp.src(conf.precss.components.files, {dot: true, base: '.'}),
		'.',
		conf.debug ? 'component precss:' : ''
	);
});
gulp.task('test-precss-one-file', function() {
	return precssWatcher({path: conf.curDir+'/components/layout/menu/main-nav/style.scss'}, 'components');
});
function precssCommonPipe(stream, dest, debugTitle) {
	let debugMode = true;
	if( 'string' != typeof(debugTitle) || '' === debugTitle ) {
		debugMode = false;
	}

	function mapSourcesCompile(sourcePath, file) {
		return mapSources(sourcePath, file, 'compile')
	}
	function mapSourcesMinify(sourcePath, file) {
		return mapSources(sourcePath, file, 'minify')
	}
	// noinspection JSUnusedLocalSymbols
	function mapSources(source, file, phase) {
		const destFilePath = Path.resolve(file.cwd, /*file.base*/dest, file.relative);
		if ( !file.hasOwnProperty('fixedSources') ) {
			file.fixedSources = [];
		}
		const fixedSource = file.fixedSources.find(function(fixedSource) {
			return fixedSource.fixed === source;
		});
		const srcFilePath = (fixedSource === undefined)
			? Path.resolve(file.cwd, file.base, source)
			: Path.resolve(fixedSource.cwd, fixedSource.base, fixedSource.source);
		const destDir = Path.relative('/'+Path.dirname(destFilePath), '/'+Path.dirname(srcFilePath));
		const resultSrc =  (destDir === '')
			? Path.basename(source)
			: destDir+'/'+Path.basename(source);

		file.fixedSources.push({
			cwd: file.cwd,
			base: file.base,
			source: source,
			fixed: resultSrc
		});
		// let prefix = 'src map: '+phase;
		// gutil.log(prefix+':-----------');
		// gutil.log(prefix+':                INPUT');
		// gutil.log(prefix+':          dest:', dest);
		// // gutil.log(prefix+':      src root:', file.sourceMap.sourceRoot);
		// gutil.log(prefix+':     file.base:', file.base);
		// gutil.log(prefix+':     file.path:', file.path);
		// gutil.log(prefix+': file.relative:', file.relative);
		// gutil.log(prefix+':        source:', source);
		// gutil.log(prefix+':                RESULT');
		// gutil.log(prefix+':          dest:', destFilePath);
		// gutil.log(prefix+':           src:', srcFilePath);
		// gutil.log(prefix+':    result src:', resultSrc);
		// gutil.log(prefix+':');
		// // gutil.log(prefix+': fixed source:');
		// // gutil.log(prefix+':', file.fixedSources);
		// gutil.log(prefix+':');
		return resultSrc;
	}

	stream = stream
		.pipe(plumber())
		.pipe(rename({extname: '.'+conf.precss.lang}))
		.pipe(sourcemaps.init())
		.pipe(precss())
		// fix for stop watching on less compile error)
		.on('error', utils.swallowError)
		.pipe(postcss([autoprefixer()]))
		.pipe(tap(function(file) {
			let parsedPath = utils.parsePath(file.relative);
			if(debugMode) {
				gutil.log(debugTitle+' compile: '+gutil.colors.blue(
					parsedPath.dirname+Path.sep
					+' { '+parsedPath.basename
					+(('.css' === parsedPath.extname) ? '.'+conf.precss.lang : '')
					+' -> '
					+parsedPath.basename+parsedPath.extname+' } '
				));
			}
		}))
		.pipe(sourcemaps.write('.', {
			includeContent: false
			,mapSources: mapSourcesCompile
		}))
		.pipe(gulp.dest(dest))
		.pipe(createBrowserSyncStream()) // update target unminified css-file and its map
	;
	if( conf.assets.min_css || conf.dev_mode.minify_useless_css ) {
		const cssFilter = filter('**/*.css');
		stream = stream.pipe(cssFilter)
			.pipe(sourcemaps.init({loadMaps: true}))
			.pipe(tap(function(file) {
				if(debugMode) {
					let parsedPath = utils.parsePath(file.relative);
					gutil.log(debugTitle+'  minify: '+gutil.colors.blue(
						parsedPath.dirname+Path.sep
						+' { '+Path.basename(parsedPath.basename, '.min')
						+(('.map' === parsedPath.extname) ? '': '.css')
						+' -> '
						+parsedPath.basename+parsedPath.extname+' } '
					));
				}
			}))
			.pipe(postcss([cssnano({zindex: false /*трудно понять зачем нужна такая фича, но мешает она изрядно*/})]))
			.pipe(rename({extname: '.min.css'}))
			.pipe(sourcemaps.write('.', {
				includeContent: false
				,mapSources: mapSourcesMinify
			}))
			.pipe(gulp.dest(dest))
			.pipe(createBrowserSyncStream()) // update .min.css, .min.css.map files
	} else {
		gutil.log(
			gutil.colors.gray('skipping css minification: checkout --production option')
		);
	}
	return stream;
}
function precssWatcher(changedFile, target) {
	if (!fs.existsSync(changedFile.path)) {
		return gutil.noop();
	}
	const file = getRelFilePath(changedFile.path)
		,fileName = Path.basename(file)
		,fileStat = fs.lstatSync(changedFile.path);
	let stream = null ,dest = null;
	if (fileStat.isDirectory()) {
		return gutil.noop();
	}
	switch(target) {
		case 'main':
			stream = gulp.src(file, {dot: true, base: conf.precss.main.base});
			stream.pipe(tap(function(file) {
				let filePath = file.path.replace(/\\/g, '/');
				let precssDir = conf.curDir+'/'+conf.precss.main.base;
				let relFilePath = null;
				precssDir = precssDir
					.replace(/\\/g, '/')
					.replace(/\/\//g, '/');
				if(filePath.indexOf(precssDir) !== 0) {
					throw 'precss file out of configured precss dir: "'+filePath+'"';
				}
				relFilePath = conf.precss.main.dest+'/'+utils.substr(filePath, precssDir.length+1);
				relFilePath = relFilePath.trim()
					.replace(/\/\//g, '/')
					.replace(/\.(less|scss)$/, '.css');
				if( null !== cssBundleFiles
					&& cssBundleFiles.indexOf(relFilePath) !== -1
				) {
					file.rebuildCssBundle = true;
				}
			}));
			dest = conf.precss.main.dest;
			if(conf.debug) gutil.log('precss watcher: '+gutil.colors.blue(file));
			break;
		case 'components':
			dest = '.';
			stream = gulp.src(
				Path.dirname(file)+'/'+conf.precss.components.styleName,
				{dot: true, base: '.'}
			);
			if(conf.debug) gutil.log(
				'precss watcher: '
				+gutil.colors.blue(dest+'/'
					+((fileName === conf.precss.components.styleName)
						? '{ '+fileName+' -> '+fileName.replace(/\.(less|scss)$/, '.css')+' }'
						: '{ '
							+'changed: '+fileName+';  compiling: '
							+conf.precss.components.styleName +' -> '
							+conf.precss.components.styleName.replace(/\.(less|scss)$/, '.css')
							+' }'
					)
				)
			);
			break;
		default:
			throw 'precss-watcher: wrong watcher target';
	}

	return precssCommonPipe(stream, dest, conf.debug ? 'precss watcher:' : '')
		.pipe(tap(function(file) {
			if (typeof file.rebuildCssBundle != 'undefined' && file.rebuildCssBundle) {
				runSequence('css-bundle');
			}
		}));
}

/**
 * Сборка css-bundle-а
 * @task {css-bundle}
 * @order {4}
 */
gulp.task('css-bundle', function() {
	let stream = new merge();

	stream.add(parseCssBundleImportListAsync(function(bundleName, relBundleFilePath, cssBundleFiles, cssBundleFilesImport) {
		if( conf.production
			|| !isInteractiveMode
			|| !conf.dev_mode.no_build_css_bundle_file
		) {
			if( cssBundleFilesImport.length > 0 ) {
				stream.add(gulp.src(relBundleFilePath, {dot: true})
					.pipe(rename(bundleName+'-import.css'))
					.pipe(tap(function(file) {
						file.contents = Buffer.from(cssBundleFilesImport, 'utf-8');
					}))
					.pipe(gulp.dest(conf.precss.main.dest))
					// Уведомляем браузер если изменился bundle-import.css
					.pipe(createBrowserSyncStream())
				);
			}

			if(Array.isArray(cssBundleFiles) && cssBundleFiles.length > 0) {
				let bundleStream = gulp.src(cssBundleFiles, {dot: true})
					.pipe(conf.debug ? debug({title: 'css bundle file:', showCount: false}) : gutil.noop())
					.pipe(plumber())
					.pipe(sourcemaps.init({loadMaps: true}))
					.pipe(tap(function(file) {
						// исправляем в стилях url(...)
						let cssFile = getRelFilePath(file.path);
						cssFile = cssFile
							.replace(/\\/g, '/')
							.replace(/\/\/\//g, '/')
							.replace(/\/\//g, '/')
							.replace(/^\//, '')
							.replace(/\/$/, '');
						let cssSrcDir = Path.dirname(cssFile).trim();
						let dest = conf.precss.main.dest.trim().replace(/^\//, '').replace(/\/$/, '');
						dest = dest
							.replace(/\\/g, '/')
							.replace(/\/\/\//g, '/')
							.replace(/\/\//g, '/')
							.replace(/^\//, '')
							.replace(/\/$/, '');
						let stepsToRootFromDest = Path.relative('/'+dest, '/');
						let urlPrefix = stepsToRootFromDest+'/'+cssSrcDir+'/';

						file.contents = Buffer.from(
							'\n/* '+cssFile+' */\n'+
							file.contents
								.toString()
								.trim()
								// исправляем в стилях url(...)
								.replace(/(url\(['"]?)(.*?)(['"]?\))/gim, '$1'+urlPrefix+'$2$3')
								// Удаляем возможные sourceMappingURL уже включенные в css-bundle
								.replace(/\n{0,2}\/\*#\s*sourceMappingURL(.*?)\*\//, '')
								.trim()
							,'utf-8'
						);

					}));
					bundleStream
					.pipe(concat(bundleName+'.css'))
					.pipe(
						( conf.production
							|| !isInteractiveMode
							|| !conf.dev_mode.no_bsync_css_bundle_file
						)
						? createBrowserSyncStream()
						: (conf.debug
							? debug({title: 'ignoring browser-sync update of css-bundle:', showCount: false})
							: gutil.noop()
						)
					)
					.pipe(sourcemaps.write('./'))
					.pipe(gulp.dest(conf.precss.main.dest))
					.pipe(tap(function(file) {
						let relFilePath = getRelFilePath(file.path);
						if(Path.extname(relFilePath) === '.css') {
							if( ! conf.assets.min_css && ! conf.dev_mode.minify_useless_css ) {
								gutil.log(
									gutil.colors.gray('skipping css minify:')
									+gutil.colors.blue(' '+relFilePath)
									+gutil.colors.gray(' (checkout --production option)')
								);
								return;
							}
							let dest = Path.dirname(relFilePath);
							stream.add(gulp.src(relFilePath)
								.pipe(sourcemaps.init({loadMaps: true}))
								.pipe(rename({extname: '.min.css'}))
								.pipe(postcss([cssnano({zindex: false /*трудно понять зачем нужна такая фича, но мешает она изрядно*/})]))
								.pipe(
									( conf.production
										|| !isInteractiveMode
										|| !conf.dev_mode.no_bsync_css_bundle_file
									)
									? createBrowserSyncStream()
									: (conf.debug
										? debug({title: 'ignoring browser-sync update of css-bundle:', showCount: false})
										: gutil.noop()
									)
								)
								.pipe(sourcemaps.write('./'))
								.pipe(gulp.dest(dest))
							);
						}
					}));

				stream.add(bundleStream);
			}
		}
		else if(conf.debug) {
			gutil.log(
				'ignoring building of css-bundle: '
				+gutil.colors.blue(bundleName+'.css')
				+gutil.colors.gray(' (--dev-no-build-css-bundle-file)')
			);
		}
	}));
	return stream;
});

gulp.task('css-bundle-parse-imports-list', function() {
	return parseCssBundleImportListAsync();
});

function parseCssBundleImportListAsync(afterParseCallback) {
	cssBundleFiles = [];
	let cssBundleFilesImport = '';
	return gulp.src(conf.precss.main.bundle)
		.pipe(conf.debug ? debug({title: 'css bundle:', showCount: false}) : gutil.noop())
		.pipe(tap(function(file) {
			let relBundleFilePath = getRelFilePath(file.path);
			let bundleName = Path.basename(file.path)
				.replace(/^_/, '')
				.replace(/\.(less|scss|css)$/i, '');

			let regim = /\s*@import\s*['"]([a-zA-Z0-9_\-\/.]+)(?:\.css|\.less|\.scss)['"];\s*/gim;
			let rei = /\s*@import\s*['"]([a-zA-Z0-9_\-\/.]+)(?:\.css|\.less|\.scss)['"];\s*/i;
			let matchedStringList = file.contents
				.toString()
				.replace(/^\/\/(.*)/gim, '') // remove line comments
				.replace(/\/\*[\s\S]*?\*\/\n?/gim, '') // remove multi line comments
				.match(regim);
			if( typeof(matchedStringList) == 'object'
				&& matchedStringList !== null
				&& matchedStringList.length > 0
			) {
				for(let iMatched=0; iMatched < matchedStringList.length; iMatched++) {
					let matchedString = matchedStringList[iMatched].trim();
					let match = matchedString.match(rei);
					if( match ) {
						let importedCssFile = match[1]+'.css';
						cssBundleFiles.push(conf.precss.main.dest+'/'+importedCssFile);
						cssBundleFilesImport +='@import "'+importedCssFile+'";\n';
					}
				}
			}

			if( typeof(afterParseCallback) == 'function' ) {
				afterParseCallback.call(this, bundleName, relBundleFilePath, cssBundleFiles, cssBundleFilesImport);
			}
		}));
}

/**
 * Сборка html-файлов
 * @task {html}
 * @order {2}
 */
gulp.task('html', function(done) {
	if( null === cssBundleFiles ) {
		// Если у нас нет данных о файлах css-bundle-а, то сначала запустим
		// сборку этих данных и получим эти данные
		//runSequence('css-bundle', '--html-nunjucks', done);

		// Для сборки надо знать только имена css-файлов,
		// совсем не обязательно собирать bundle, ибо долго
		runSequence('css-bundle-parse-imports-list', '--html-nunjucks', done);
	}
	else {
		runSequence('--html-nunjucks', done);
	}
});
// Это системная задача, которая не должна выполняться через консоль
// Есть гипотеза, что если дать ей имя с префиксом в виде двух дефисов
// то интерпретатор команд не сможет скормить gulp-у --html-nunjucks
// как имя задачи, ибо "--agrument-name" интерпретируется как аргумент getopts
// а значит будет разрешено только внутреннее использование
// только в javascript-коде

let njkAssets = {};
gulp.task('--html-nunjucks', function() {
	nunjucksRender.nunjucks.configure();
	njkAssets = new NunjucksBitrix.ComponentsAssets(conf);
	// noinspection JSUnusedGlobalSymbols
	return gulp.src(conf.html.pages)
		.pipe(plumber())
		.pipe(conf.debug ? debug({title: 'compile page: '}) : gutil.noop())
		.pipe(tap(function(file) {
			njkAssets.currentPage = getRelFilePath(file.path);
		}))
		.pipe(NunjucksBitrix.injectData(conf, cssBundleFiles))
		.pipe(nunjucksRender({
			path: conf.curDir
			,ext: '.html'
			,manageEnv: function(env) {
				env.curDir = conf.curDir;
				//onsole.log(env);
				env.addExtension('BitrixComponents', new NunjucksBitrix.ComponentTag(conf, njkAssets, env));
				env.addExtension('BitrixComponentAssetsCssPlaceHolder', new NunjucksBitrix.ComponentAssetsCssPlaceHolder());
				env.addExtension('BitrixComponentAssetsJsPlaceHolder', new NunjucksBitrix.ComponentAssetsJsPlaceHolder());
				nunjucksIncludeData.install(env);
			}
		}))
		.pipe(NunjucksBitrix.replaceAssetsPlaceHolders(njkAssets))
		.pipe(gulp.dest(conf.html.dest))
		.on('end', function() { reloadBrowserSync(); })
	;
});


/**
 * Обработка скриптов
 * @task {js}
 * @order {5}
 */
gulp.task('js', function(done) {
	runSequence(['js-bundle', 'js-scripts'], done);
});



/**
 * Сборка скриптов из src в bundle
 * @task {js-bundle}
 * @order {7}
 */
gulp.task('js-bundle', function() {
	return jsTools.buildJsBundles();
});

/**
 * Обработка всех файлов скриптов
 * @task {js-scripts}
 * @order {6}
 */
gulp.task('js-scripts', function(done) {
	let stream = gulp.src(conf.js.scripts, {dot: true, base: '.'});
	if( conf.assets.min_js || conf.dev_mode.minify_useless_js ) {
		stream = jsTools.addMinificationToJsStream(
			stream,'.', conf.debug ? 'js-script:' : ''
		);
	}
	else if(conf.debug) gutil.log(
		gutil.colors.gray('skipping js-scripts minification')
		+gutil.colors.gray(' (checkout --production option)')
	);
	return stream.pipe(createBrowserSyncStream());
});

function jsWatcher(changedFile) {
	if (!fs.existsSync(changedFile.path)) {
		return gutil.noop();
	}
	const file = getRelFilePath(changedFile.path)
		,dest = Path.dirname(file)
		,fileName = Path.basename(file)
		,fileStat = fs.lstatSync(changedFile.path)
	;
	if (fileStat.isDirectory()) {
		return gutil.noop();
	}
	if (conf.debug) gutil.log(
		'js script: '+gutil.colors.blue(
			dest+'/{ '+fileName+' -> '+fileName.replace(/\.js/, '.min.js')+' }'
		)
	);
	let stream = gulp.src(file);
	if (conf.assets.min_js || conf.dev_mode.minify_useless_js) {
		stream = jsTools.addMinificationToJsStream(stream, dest);
	} else if(conf.debug) {
		gutil.log(
			gutil.colors.gray('skipping minify of ')
			+gutil.colors.blue(file)
			+gutil.colors.gray(' (checkout --production option)')
		);
	}
	stream.pipe(createBrowserSyncStream());
	return stream;
}


/**
 * Сборка svg-иконок в иконочный шрифт (glyphicon)
 * @task {svg-icons-font}
 * @order {11}
 */
gulp.task('svg-icons-font', function() {
	// let runTimestamp = Math.round(Date.now()/1000);
	return gulp.src(conf.svgIconFont.src, {dot: true, base: '.'})
		.pipe(plumber())
		.pipe(debug({title: 'svg-icon'}))
		.pipe(iconfontCss({
			fontName: conf.svgIconFont.fontName
			,path: conf.svgIconFont.template
			,targetPath: conf.svgIconFont.result
			,fontPath: conf.svgIconFont.dest
			,cssClass: conf.svgIconFont.cssClass
		}))
		.pipe(iconfont({
			fontName: conf.svgIconFont.fontName
			,formats: conf.svgIconFont.formats
			,normalize: true
			,fontHeight: 1001
		}))
		.pipe(gulp.dest(conf.svgIconFont.dest));
});

/**
 * @task {ttf-to-web-fonts}
 */
gulp.task('ttf-to-web-fonts', function () {
	let stream = merge();
	// stream.add(gulp.src(conf.webFonts.src)
	// 	.pipe(gulp.dest(conf.webFonts.dest)))
	stream.add(gulp.src(conf.webFonts.src)
		.pipe(ttf2eot())
		.pipe(gulp.dest(conf.webFonts.dest)));
	stream.add(gulp.src(conf.webFonts.src)
		.pipe(ttf2woff())
		.pipe(gulp.dest(conf.webFonts.dest)));
	stream.add(gulp.src(conf.webFonts.src)
		.pipe(ttf2woff2())
		.pipe(gulp.dest(conf.webFonts.dest)));
	// noinspection JSUnresolvedFunction
	return stream.pipe(conf.debug ? debug({title: 'web-font'}) : gutil.noop());
});

/**
 * Скачивание шрифтов с google-web-fonts
 * @task {google-web-fonts}
 * @order {12}
 */
gulp.task('google-web-fonts', function() {
	return gulp.src(conf.googleWebFonts.fontsList)
		.pipe(googleWebFonts({
			fontsDir: conf.googleWebFonts.fontsDir
			,cssDir: conf.googleWebFonts.cssDir
			,cssFilename: conf.googleWebFonts.cssFilename
		}))
		.pipe(gulp.dest(conf.googleWebFonts.dest));
});

/**
 * Оптимизация картинок в папке sources/images/ и копирование
 * оптимизированных в images/
 * @task {images}
 * @order {9}
 */
gulp.task('images', ['images:common', 'images:components']);
gulp.task('images:common', function() {
	let fileCount = 0;
	const debugTitle = 'optimizing image: ';
	const doneDebugTitle = 'optimized images: ';
	return gulp.src(conf.images.common.src, {dot: true})
		.pipe(imagemin([
			imagemin.optipng(conf.images.png),
			imagemin.mozjpeg(conf.images.jpeg),
			imagemin.gifsicle(conf.images.gifscale),
			imagemin.svgo({ plugins: [ { removeViewBox: conf.images.svgo.removeViewBox } ] })
		]))
		.pipe(conf.images.svgz ? svg2z() : gutil.noop())
		.pipe(conf.debug ? through2.obj((file, enc, cb) => {
			const relBase = Path.relative(file.cwd, file.base);
			gutil.log(debugTitle+gutil.colors.blue(`{ ${relBase} -> ${conf.images.common.dest} }/${file.relative}`));
			fileCount++;
			cb(null, file);
		}, done => {
			gutil.log(doneDebugTitle+gutil.colors.green(`${fileCount} items`));
			done();
		}) : gutil.noop())
		.pipe(gulp.dest(conf.images.common.dest))
		.pipe(createBrowserSyncStream());
});
gulp.task('images:components', function() {
	let fileCount = 0;
	const debugTitle = 'optimizing component image: ';
	const doneDebugTitle = 'optimized components images: ';
	return gulp.src(conf.images.components.src, {dot: true, base: '.'})
		.pipe(imagemin([
			imagemin.optipng(conf.images.png),
			imagemin.mozjpeg(conf.images.jpeg),
			imagemin.gifsicle(conf.images.gifscale),
			imagemin.svgo({ plugins: [ { removeViewBox: conf.images.svgo.removeViewBox } ] })
		]))
		.pipe(conf.images.svgz ? svg2z() : gutil.noop())
		.pipe(conf.debug ? through2.obj(function(file, enc, cb) {
			const pathParts = file.relative.split(`/${conf.images.components.srcFolder}/`);
			fileCount++;
			if (pathParts.length === 2) {
				file.path = pathParts.join(`/${conf.images.components.destFolder}/`)
				if (conf.debug) gutil.log(debugTitle + gutil.colors.blue(
					`${pathParts[0]}/{ ${conf.images.components.srcFolder}`
					+` -> ${conf.images.components.destFolder} }/${pathParts[1]}`
				));
			} else if (conf.debug) {
				gutil.log(debugTitle + gutil.colors.blue(file.relative));
			}
			cb(null, file);
		}, done => {
			gutil.log(doneDebugTitle+gutil.colors.green(`${fileCount} items`));
			done();
		}) : gutil.noop())
		.pipe(gulp.dest('.'))
		.pipe(createBrowserSyncStream());
});

/**
 * Собрать картинки и стили спрайтов
 * @task {sprites}
 * @order {10}
 */
gulp.task('sprites', function() {
	let resultStream = merge();
	// нам над достать миксины из первого сспрайта и положить в отдельный файл
	let spriteBatchCounter = 0;
	getSpriteBatchList().forEach(function(spriteBatch) {
		let filterSpriteImg = filter('*.png', {restore: true})
			,filterLess = filter('*.less', {restore: true});
		// noinspection JSUnusedGlobalSymbols
		spriteBatch.stream
			.pipe(conf.debug ? debug({title: 'sprite "'+spriteBatch.name+'" image:'}) : gutil.noop())
			// Компилируем спрайты
			.pipe(spritesmith({
				imgName: spriteBatch.name+'.png'
				,imgPath: conf.sprites.imgUrl+'/'+spriteBatch.name+'.png'
				,cssName: spriteBatch.name+'.less'
				,cssVarMap: function (sprite) {
					sprite.name = 'sprite-'+spriteBatch.name+'-' + sprite.name;
				}
			}))
			// Убираем из less файлов лишнее и выделяем миксины в отдельный файл
			.pipe(tap(function(file) {
				if(Path.extname(file.path) === '.less') {
					let fileContent = file.contents.toString();
					// remove line comments
					fileContent = fileContent.replace(/^\/\/(.*)/gmi, '');
					// remove multi line comments
					fileContent = fileContent.replace(/\/\*[\s\S]*?\*\/\n?/gmi, '');

					// получаем миксины для размещения в отдельном файле
					// берем только один раз из первого спрайта
					// как это провернуть написано тут:
					// https://github.com/gulpjs/gulp/blob/master/docs/recipes/make-stream-from-buffer.md
					// и сделано по аналогии
					if(0 === spriteBatchCounter) {
						let matches = fileContent.match(/^\.sprites?[(\-][\s\S]*?\n}/gmi)
							,mixinsContent = '';
						matches.forEach(function(text) {
							mixinsContent += text+'\n';
						});
						// noinspection JSUnusedLocalSymbols
						let lessMixinsFileName = Path.basename(conf.sprites.dest.lessMixins)
							,lessMixinsDir = Path.dirname(conf.sprites.dest.lessMixins)
							,lessMixinsSpriteStream = vsource(lessMixinsFileName)
							,lessMixinsSpriteStreamEnd = lessMixinsSpriteStream
						;
						// noinspection JSUnresolvedFunction
						lessMixinsSpriteStream.write(mixinsContent);
						process.nextTick(function() {
							// noinspection JSUnresolvedFunction
							lessMixinsSpriteStream.end();
						});

						// noinspection JSUnresolvedFunction
						lessMixinsSpriteStream
							.pipe(conf.debug ? debug({title: 'spriteBatch less mixin:'}) : gutil.noop())
							.pipe(vbuffer())
							.pipe(gulp.dest(lessMixinsDir))
						;
						resultStream.add(lessMixinsSpriteStream);
					}

					// remove all except less-vars
					fileContent = fileContent.replace(/^[^@](.*)/gmi, '');
					//rename @spritesheet -> @spritesheet-{spriteBatch.name}
					fileContent = fileContent.replace(/@spritesheet/gmi, '@spritesheet-'+spriteBatch.name);
					// remove spaces
					fileContent = fileContent.replace(/\n\n/gmi, '');
					file.contents = Buffer.from(fileContent, 'utf-8');
					spriteBatchCounter++;
				}
			}))
			.pipe(filterSpriteImg)
			.pipe(gulp.dest(conf.sprites.dest.img))
			//.pipe((!conf.sprites.minify)?gutil.noop():imagemin()) - падает с ошибкой
			.pipe((!conf.sprites.minify)?gutil.noop():tap(function(file) {
				// берем уже сохраненный файл в новый стрим
				let relFilePath = getRelFilePath(file.path)
					,destDir = Path.dirname(relFilePath);
				return gulp.src(relFilePath, {dot: true})
					.pipe(imagemin())
					.pipe(gulp.dest(destDir))
			}))
			.pipe(filterSpriteImg.restore)
			.pipe(filterLess)
			.pipe(gulp.dest(conf.sprites.dest.less))
			.pipe(filterLess.restore)
			.pipe(createBrowserSyncStream())
		;
		resultStream.add(spriteBatch.stream);
	});
	return resultStream;
});

let spriteBatchNames = null;
function getSpriteBatchNames() {
	if(null == spriteBatchNames) {
		let spritesDir = conf.curDir+'/'+conf.sprites.src;
		let dirItems = fs.readdirSync(spritesDir);
		spriteBatchNames = [];
		dirItems.forEach(function(item) {
			let stat = fs.lstatSync(spritesDir+'/'+item);
			if( stat.isDirectory() ) {
				spriteBatchNames.push(item);
			}
			return true;
		});
	}
	return spriteBatchNames;
}

let spriteBatchList = null;
function getSpriteBatchList() {
	if( null != spriteBatchList ) return spriteBatchList;
	if( getSpriteBatchNames().length > 0 ) {
		spriteBatchList = [];
		getSpriteBatchNames().forEach(function(batchName) {
			spriteBatchList.push({
				name: batchName
				,stream: gulp.src(conf.sprites.src+'/'+batchName+'/*.png')
			});
		});
	}
	return spriteBatchList;
}

/**
 * Собрать проект. Собирает стили, js-файлы и html-файлы.
 * Спрайты, загрузка шрифтов, созание иконочных шрифтов этой задачей на затрагиваются и должны быть запущены явно.
 * @task {build}
 * @order {1}
 */
gulp.task('build', function(done) {
	// Все последовательно, параллельность тут все равно не дает скорости
	runSequence(
		'precss-main',
		'css-bundle',
		'precss-components',
		'js-bundle',
		'js-scripts',
		'--html-nunjucks',
		done
	);
});


function parsePreCssDependencies(src, treePath, deepDependenciesIndex) {
	//let _debug = function() { console.log('', ...arguments); };
	let _debug = function() {};
	if( typeof(treePath) != 'object' || ! Array.isArray(treePath) ) {
		treePath = [];
	}
	if( typeof(deepDependenciesIndex) != 'object' || null === deepDependenciesIndex ) {
		deepDependenciesIndex = {};
		if( conf.debug ) {
			gutil.log(gutil.colors.blue('Building the less import dependency tree'));
		}
	}

	let depth = treePath.length+1;
	let dependencyOf = (treePath.length > 0)?treePath[treePath.length-1]:'';

	let dependencies = {};

	//_debug('call', arguments);

	return new Promise(function(resolve, reject) {
		_debug('| '.repeat(depth-1)+'@ RUN PROMISE'+(dependencyOf?' for '+dependencyOf:''));
		if( depth >= 10 ) {
			_debug('| '.repeat(depth)+'rejected by depth limit');
			reject(' imports depth limit succeeded');
		}

		gulp.src(src, {dot: true, base: '.'})
		.pipe(tap(function(file) {
			let precssCode = file.contents.toString();
			_debug('| '.repeat(depth)+'- file', file.path);

			let dir = Path.dirname(file.path);
			// let fileName = Path.basename(file.path);
			if( typeof(dependencies[file.path]) != 'object'
				|| !Array.isArray(dependencies[file.path])
			) {
				dependencies[file.path] = [];
			}

			let regImport_gim = /@import[\s]*((?:\([a-zA-Z]+\))?)[\s]*['"](.*?)['"][\s]*;/gim;
			let regImport     = /@import[\s]*((?:\([a-zA-Z]+\))?)[\s]*['"](.*?)['"][\s]*;/i;
			let matches = precssCode
				.replace(/^\/\/(.*)/gim, '') // remove line comments
				.replace(/\/\*[\s\S]*?\*\/\n?/gim, '') // remove multi line comments
				.match(regImport_gim);
			if( null != matches ) {
				matches.forEach(function(matchedImport) {
					let matchParts = matchedImport.match(regImport);
					let importFilePath = matchParts[2].trim();
					if( ! /(\.less|\.scss|\.css)$/.test(importFilePath) ) {
						importFilePath += '.'+conf.precss.lang;
					}
					let dep = /^\./.test(importFilePath)
						? Path.resolve(dir, importFilePath)
						: Path.resolve(conf.curDir, importFilePath);
					_debug('| '.repeat(depth+1)+'- import:', dep);
					dependencies[file.path].push(dep);
					if (conf.precss.lang === 'scss') {
						let fileName = Path.basename(dep);
						let dirName = Path.dirname(dep);
						if ( ! /^_/.test(fileName) ) {
							dependencies[file.path].push(dirName+'/_'+fileName);
						}
					}
				});
			}
		}))
		.on('error', function(err) {
			reject(err);
		})
		.on('end', async function() {
			_debug('| '.repeat(depth-1)+'@ END'+(dependencyOf?' for '+dependencyOf:''));
			//_debug('| '.repeat(depth-1)+'# treePath', treePath);
			//_debug('| '.repeat(depth-1)+'# dependecyOf', dependecyOf);

			for(let filePath in dependencies) {
				if( dependencies[filePath].length > 0 ) {
					_debug('| '.repeat(depth)+'|-> RECURSION for '+filePath);
					let deeperTreePath = treePath.slice();
					deeperTreePath.push(filePath);
					dependencies[filePath].forEach(function(importedFile) {
						if( typeof(deepDependenciesIndex[importedFile]) == 'undefined' ) {
							deepDependenciesIndex[importedFile] = [];
						}
						deeperTreePath.forEach(function(treePathItem) {
							if( -1 === deepDependenciesIndex[importedFile].indexOf(treePathItem) ) {
								deepDependenciesIndex[importedFile].push(treePathItem);
							}
						});
					});
					try {
						//let recursionResult =
						await parsePreCssDependencies(
							dependencies[filePath],//.slice(),
							deeperTreePath,
							deepDependenciesIndex
						);
					}
					catch(e) {
						reject(e);
					}
					//onsole.log('# recursionResult', recursionResult);
				}
			}
			_debug('| '.repeat(depth-1)+'@ RESOLVE'+(dependencyOf?' for '+dependencyOf:''));
			resolve({
				dependencies: dependencies,
				deepDependenciesIndex: deepDependenciesIndex
			});
		});
	});
}

gulp.task('test-precss-imports-tree', function() {
	// let src = conf.precss.main.watchImports;
	// let src = conf.precss.main.files;
	// let src = conf.precss.components.files;
	// let src = [];
	let src = conf.precss.components.files.concat(conf.precss.main.files);
	return parsePreCssDependencies(src)
	.then(function(res) {
		console.log(JSON.stringify(res, null, 4));
	})
	.catch(function(error) {
		throw error;
	});
});

/**
 * Запуск интерактивного режима с наблюдением за файлами
 * и пересборкой при изменении, но без запуска веб-сервера
 * @task {watch}
 * @order {13}
 */
let watchers = [];
const WATCH_OPTIONS = {cwd: './'};
let precssDeepDependenciesIndex = null;
gulp.task('watch', function(done) {
	isInteractiveMode = true;
	if( watchers.length > 0 ) {
		runSequence('remove-watchers', 'css-bundle-parse-imports-list', 'add-watchers', 'watch-hotkeys', done);
	}
	else {
		runSequence('css-bundle-parse-imports-list', 'add-watchers', 'watch-hotkeys', done);
	}
});


gulp.task('add-watchers', async function () {
	// html
	watchers.push(gulp.watch(conf.html.watch, WATCH_OPTIONS, ['html']));

	// precss
	//watchers.push(gulp.watch(conf.precss.main.watchImports, WATCH_OPTIONS, ['precss-main-bundle']));
	let allPrecssSrc = conf.precss.components.files.concat(conf.precss.main.files);
	watchers.push(gulp.watch(conf.precss.main.watchImports, WATCH_OPTIONS, async function(changed) {
		if(null === precssDeepDependenciesIndex) {
			precssDeepDependenciesIndex = (await parsePreCssDependencies(allPrecssSrc)).deepDependenciesIndex;
			//onsole.log('precss dep tree parsed');
		}
		// else {
		// 	//onsole.log('precss dep tree is ready');
		// }
		if( typeof(precssDeepDependenciesIndex[changed.path]) == 'object'
			&& Array.isArray(precssDeepDependenciesIndex[changed.path])
			&& precssDeepDependenciesIndex[changed.path].length > 0
		) {
			let matchedComponentFiles = [];
			let matchedMainFiles = [];
			precssDeepDependenciesIndex[changed.path].forEach(function(dependentFile) {
				let dependentFileRelPath = getRelFilePath(dependentFile);
				let matchedMain = false;
				let filteredMain = false;
				let matchedComponent = false;
				let filteredComponent = false;
				// noinspection DuplicatedCode
				for(let mainFilePatternKey=0; mainFilePatternKey < conf.precss.main.files.length; mainFilePatternKey++) {
					let mainFilePattern = conf.precss.main.files[mainFilePatternKey];
					if( minimatch(dependentFileRelPath, mainFilePattern, {flipNegate: true}) ) {
						if(mainFilePattern[0] === '!') {
							filteredMain = true;
							break;
						}
						else {
							matchedMain = true;
						}
					}
				}
				// noinspection DuplicatedCode
				for(let patternKey=0; patternKey < conf.precss.components.files.length; patternKey++) {
					let componentPattern = conf.precss.components.files[patternKey];
					if( minimatch(dependentFileRelPath, componentPattern, {flipNegate: true}) ) {
						if(componentPattern[0] === '!') {
							filteredComponent = true;
							break;
						}
						else {
							matchedComponent = true;
						}
					}
				}
				if( matchedMain && ! filteredMain ) {
					matchedMainFiles.push(dependentFile);
				}
				if( matchedComponent && ! filteredComponent ) {
					matchedComponentFiles.push(dependentFile);
				}
			});
			matchedMainFiles.forEach(function(fileFullPath) {
				precssWatcher({path: fileFullPath}, 'main');
			});
			matchedComponentFiles.forEach(function(fileFullPath) {
				precssWatcher({path: fileFullPath}, 'components');
			});
		}
	}));
	watchers.push(gulp.watch(conf.precss.main.bundle, WATCH_OPTIONS, ['css-bundle']));
	watchers.push(gulp.watch(conf.precss.main.files, WATCH_OPTIONS, function(changed) {
		precssDeepDependenciesIndex = null;
		return precssWatcher(changed, 'main');
	}));
	watchers.push(gulp.watch(conf.precss.components.watch, WATCH_OPTIONS, function(changed) {
		precssDeepDependenciesIndex = null;
		return precssWatcher(changed, 'components');
	}));

	// js
	watchers.push(gulp.watch(conf.js.scripts, WATCH_OPTIONS, function(changed) {
		return jsWatcher(changed);
	}))
	if( ! conf.dev_mode.js_bundle_no_watching ) {
		watchers.push(gulp.watch(conf.js.bundle.watch, WATCH_OPTIONS, function(changed) {
			let empty = true;
			let rebuildBundle = undefined;
			for (let bundleName in jsTools.bundles) {
				if (jsTools.bundles.hasOwnProperty(bundleName)) {
					empty = false;
					let foundDep = jsTools.bundles[bundleName].deps.find((filePath) => filePath === changed.path);
					if (foundDep) {
						rebuildBundle = jsTools.bundles[bundleName];
						break;
					}
				}
			}
			if (empty) {
				return jsTools.buildJsBundles();
			} else if (rebuildBundle) {
				return jsTools.createBundleStream(rebuildBundle);
			}
		}));
	}
});
gulp.task('remove-watchers', async function() {
	precssDeepDependenciesIndex = null;
	// noinspection JSUnusedLocalSymbols
	watchers.forEach(function(watcher, index) {
		watcher.end();
	});
	watchers = [];
	//done(); нет смысла если используем async-функцию
});

gulp.task('--begin-interactive-mode-task-action', function() {
	isInteractiveMode = false;
	switchBrowserSync(false);
});

gulp.task('--finish-interactive-mode-task-action', function(done) {
	isInteractiveMode = true;
	switchBrowserSync(true);
	reloadBrowserSync(done);
});

/**
 * Слежение за горячими клавишами.
 * Подсказка по горячим клавишам: $ gulp help-hk | precss
 * @task {watch-hotkeys}
 * @order {16}
 */
gulp.task('watch-hotkeys', function() {

	let keyListener = new KeyPressEmitter();

	keyListener.on('showHotKeysHelp', function() {
		runSequence('help-hk');
	});
	keyListener.on('showHelp', function() {
		runSequence('help');
	});
	keyListener.on('reloadWatchers', function() {
		if( watchers.length > 0 ) {
			runSequence('remove-watchers', 'add-watchers');
		}
		else {
			runSequence('add-watchers');
		}
	});
	keyListener.on('removeWatchers', function() {
		runSequence('remove-watchers');
	});
	keyListener.on('buildHtml', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'html',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('buildAllStyles', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'precss-main', 'precss-components',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('buildMainStyles', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'precss-main',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('buildMainStylesAndBundle', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'precss-main-bundle',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('buildAllStylesAndBundle', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'precss',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('buildComponentStyles', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'precss-components',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('buildCssBundle', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'css-bundle',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('buildJs', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'js',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('buildJsScripts', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'js-scripts',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('buildJsBundle', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'js-bundle',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('buildJsVendorBundle', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'js-vendor-bundle',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('optimizeImages', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'images',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('buildSprites', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'sprites',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('buildCsvIconsFont', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'svg-icons-font',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('downloadGoogleWebFonts', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'google-web-fonts',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('switchDebugMode', function() {
		conf.debug = !conf.debug;
		gutil.log(gutil.colors.magenta('Debug mode switched to "'+(conf.debug?'true':'false')+'"'))
	});
	keyListener.on('switchProductionMode', function() {
		conf.production = !conf.production;
		gutil.log(gutil.colors.magenta('Production mode switched to "'+(conf.production?'true':'false')+'"'));
		gutil.log(gutil.colors.green('After production mode switch you should to do full rebuild [key "b"] to take effect.'));
	});
	keyListener.on('reloadAll', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'precss-components', 'js-scripts', 'html', 'add-watchers',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.on('build', function() {
		runSequence(
			'--begin-interactive-mode-task-action', 'remove-watchers',
			'build',
			'--finish-interactive-mode-task-action', 'add-watchers'
		);
	});
	keyListener.start();
});
gulp.task('keys-debug', function() {
	isInteractiveMode = true;
	let keyListener = new KeyPressEmitter();
	keyListener.debug = true;
	keyListener.start();
});


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
		//process.stdin.setEncoding('utf8');
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

		if( ( false === key.shift && key.name === 'q')
			|| (key.ctrl && key.name === 'c')
		) {
			process.exit();
		}
		if(this.debug) {
			console.log('decode keypress\n', key, data.toString());
		}
		else if( key.sequence === '\r' ) {
			console.log();
		}

		if( key.name === 'f1' && false === key.shift
			&& false === key.ctrl && false === key.meta
		) {
			gutil.log('Hot key [F1]: Show hot keys help');
			this.emit('showHotKeysHelp');
		}
		else if( key.name === 'f2' && false === key.shift
			&& false === key.ctrl && false === key.meta
		) {
			gutil.log('Hot key [F2]: Show help');
			this.emit('showHelp');
		}
		else if( true === key.shift && key.name === 'w' ) {
			gutil.log('Hot key [Shift+w]: Remove watchers');
			this.emit('removeWatchers');
		}
		else if( false === key.shift && key.name === 'w' ) {
			gutil.log('Hot key [w]: Reload watchers');
			this.emit('reloadWatchers');
		}
		else if( false === key.shift && key.name === 'h' ) {
			gutil.log('Hot key [h]: Build html');
			this.emit('buildHtml');
		}
		else if( true === key.shift && key.name === 's' ) {
			gutil.log('Hot key [Shift+s]: Build main styles and bundle');
			this.emit('buildMainStylesAndBundle');
		}
		else if( false === key.shift && key.name === 's' ) {
			gutil.log('Hot key [s]: Build main styles (w/o -bundle)');
			this.emit('buildMainStyles');
		}
		else if( true === key.shift && key.name === 'a' ) {
			gutil.log('Hot key [Shift+a]: Build all styles (main + bundle + components)');
			this.emit('buildAllStylesAndBundle');
		}
		else if( false === key.shift && key.name === 'a' ) {
			gutil.log('Hot key [Shift+a]: Build all styles (main + components)');
			this.emit('buildAllStyles');
		}
		else if( true === key.shift && key.name === 'l' ) {
			gutil.log('Hot key [l]: Build only bundle of main styles');
			this.emit('buildCssBundle');
		}
		else if( false === key.shift && key.name === 'l' ) {
			gutil.log('Hot key [Shift+l]: Build component styles');
			this.emit('buildComponentStyles');
		}
		else if( false === key.shift && key.name === 'j' ) {
			gutil.log('Hot key [j]: Build js-bundle');
			this.emit('buildJsBundle');
		}
		else if( true === key.shift && key.name === 'j' ) {
			gutil.log('Hot key [Shift+j]: Build js-vendor-bundle');
			this.emit('buildJsVendorBundle');
		}
		else if( false === key.shift && key.name === 'k' ) {
			gutil.log('Hot key [k]: Build js-scripts (w/o bundles)');
			this.emit('buildJsScripts');
		}
		else if( true === key.shift && key.name === 'k' ) {
			gutil.log('Hot key [Shift+k]: Build js-scripts and all bundles');
			this.emit('buildJs');
		}
		else if( key.shift && key.name === 'i' && key.sequence === 'I' ) {
			gutil.log('Hot key [Shift+i]: Build sprites');
			this.emit('buildSprites');
		}
		else if( false === key.shift && key.name === 'i' && key.sequence === 'i' ) {
			gutil.log('Hot key [i]: Optimize images');
			this.emit('optimizeImages');
		}
		else if( false === key.shift && key.name === 'f' ) {
			gutil.log('Hot key [f]: Build csv-icons-font');
			this.emit('buildCsvIconsFont');
		}
		else if( false === key.shift && key.name === 'g' ) {
			gutil.log('Hot key [g]: Download goole-web-fonts');
			this.emit('downloadGoogleWebFonts');
		}
		else if( key.shift && key.name === 'd' && key.sequence === 'D' ) {
			gutil.log('Hot key [Shift+d]: Switch debug mode');
			this.emit('switchDebugMode');
		}
		else if( key.shift && key.name === 'p' && key.sequence === 'P' ) {
			gutil.log('Hot key [Shift+p]: Switch production mode');
			this.emit('switchProductionMode');
		}
		else if( false === key.shift && key.name === 'r' ) {
			gutil.log('Hot key [r]: Reload components');
			this.emit('reloadAll');
		}
		else if( false === key.shift && key.name === 'b' ) {
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

function showHelpHotKeys(done) {
	console.log(`
    Горячие клавиши как правло не содержат нажатий Ctrl или Alt
    и срабатывают при нажатии непосредственно на одну целевую клавишу.
    Будте аккуратны :)

        "F1" - Вывести эту справку

        "q" - Выход. Завершает интерактивный режим (watch|layout).
 "Ctrl + c" - То же что "q"

        "w" - Перезагрузить watcher-ы. Это актуально потому, что gulp.watch()
                не очень правильно обрабатывает добавление или удаление
                файлов. Что порождает очень большую возьню с правильными glob-шаблонами,
                которые будут корректно отрабатывать. Более того, используемая в Битриксе практика
                именовать папки начиная с точки "." вообще исключает корректную работу.
              Потому иногда надо просто перегрузить watcher-ы и вновь добавленные файлы будут учтены.

"Shift + w" - Удалить watcher-ы,
                Дабы произвести удаление или перемещение файлов и папок.
                Это убережет процесс интерактивного режима от падения
                в результате обращения watcher-ов к уже отсутствующим на ФС элементам.
                Для повторного запуска нажмите "w".

        "r" - Более масштабная перегрузка watcher-ов включающая пересборку html, precss и js
              Это необходимо например потому, что тот же html зависит от состава файлов css-bundle-а.
              При создании новых компонентов и шаблонов необходимо использовать именно этот вариант.

"Shift + d" - Переключить debug-mode в противоположный.
              Так же уравляется ключем. $ gulp some-task --dbg

"Shift + p" - Переключить production-mode.
              Так же управляется ключем. $ gulp some-task --production

        "h" - Сборка njk-файлов в html. Аналог $ gulp html

        "s" - Сборка основных стилей.
              Аналог $ gulp precss-main
"Shift + s" - Сборка основных стилей и их bundle-а
              Аналог $ gulp precss-main-bundle

        "a" - Сборка всех стилей (но без сборки bundle-а).
              Аналог $ gulp precss-main && gulp precss-components
"Shift + a" - Полный сборка всех стилей: компоненты, основные стили + bundle.
              Аналог $ gulp precss

        "l" - Соберет только precss-файлы компонентов (component/ns/name/tpl/style.(less|scss)).
              Аналог $ gulp precss-components

"Shift + l" - Сборка только css-bundle-а.
              Аналог $ gulp css-bundle

        "j" - Сборка js-bundle(ов)
              Аналог $ gulp js-bundle
              из js/src/_<bundle_name>.js -> js/bundle.<bundle_name[.min].js
              Как bundle один js/src/bundle.index.js -> js/bundle.index[.min].js
              <bundle_name> не может значение "vendor"
"Shift + j" - Сборка js-vendor-bundle(а)
              Аналог $ gulp js-vendor-bundle
              из js/vendor/bundle.vendor.js -> js/bundle.vendor[.min].js

        "k" - Обработка всех скриптов кроме js-bundle-ов.
              Чаще всего используется для файлов script.js в компонентах
              Аналог $ gulp js-scripts
"Shift + k" - Полная обработка js-файлов в т.ч. создание js-bundle-ов
              Аналог $ gulp js

        "i" - Минификация картинок в папке img.src/ с перемещением в images/
              Аналог $ gulp images

"Shift + i" - Производит сборку спрайтов.
              Аналог $ gulp sprites

        "f" - Сборка svg-файлов в иконочный шрифт
              Аналог $ gulp svg-icons-font

        "g" - Загрузка шрифтов google-web-fonts (fonts.google.com)
              Аналог $ gulp google-web-fonts
              Загрузка повлечет за собой создание precss-файлов, на которые
              настроен watcher, соответственно будут пересобраны все precss-файлы $ gulp precss

        "b" - Полная сборка проекта. Аналог $ gulp build

`);
	done();
}
/**
 * Вывести справки по горячим клавишам интерактивного режима
 * @task {help-hk}
 * @order {17}
 */
gulp.task('help-hk', showHelpHotKeys);
gulp.task('help-hotkeys', showHelpHotKeys);



/**
 * Запустить разработку вёрстки в интерактивном режиме.
 * (Слежение за файлами + встроенный веб-сервер с автоматической перезагрузкой)
 * @task {layout}
 * @order {14}
 */
gulp.task('serve', function(done) {
	//runSequence('build', 'watch', 'run-browser-sync');
	runSequence('watch', 'run-browser-sync');
	done();
});


/**
 * Запустить разработку в режиме проксирования
 * виртуального хоста веб-сервера php. Удобно для тестирования
 * на мобильных устройствах, поскольку редко удается быстро настроить
 * wifi роутер для обработки доменов виртуальных хостов на машине разработчика.
 * Соответственно имеет смысл прокировать на отдельный порт localhost-а
 * @task {phpdev}
 * @order {15}
 */
gulp.task('phpdev', function(done) {
	//runSequence('build', 'watch', 'run-lamp-proxy');
	runSequence('watch', 'run-lamp-proxy');
	done();
});

function browserSyncSvgzMiddleware(req, res, next) {
	if ('.svgz' === Path.extname(req.url)) {
		res.setHeader("Content-Encoding", "gzip");
	}
	next();
}

gulp.task('run-browser-sync', function() {
	// noinspection JSUnusedGlobalSymbols
	browserSync.init({
		...conf.browserSync,
		middleware: browserSyncSvgzMiddleware
	});
});

gulp.task('run-lamp-proxy', function() {
	browserSync.init({
		proxy: conf.proxyLamp,
		port: '8008',
		open: false
	});
});

gulp.task('default', ['help']);
gulp.task('help', function () {
	// noinspection JSCheckFunctionSignatures
	return helpDoc(gulp, {
		lineWidth: 120,
		keysColumnWidth: 20,
		logger: console
	});
});

//////////////////////////
}; // end main function //
//////////////////////////
