const fs = require('fs')
	,Path = require('path')
	,extend = require('extend')
	,tap = require('gulp-tap')
	,gutil = require('gulp-util')
	,data = require('gulp-data')
	,utils = require('../utils')
	,nunjucks = require('nunjucks')
;

/**
 * TODO: write new tag {% bx_asset_js  "path/to/file.js"  %}
 * TODO: write new tag {% bx_asset_css "path/to/file.css" %}
 */
class ComponentsAssets {

	constructor(conf) {
		this.curDir = conf.curDir;
		this.js = [];
		this.css = [];
		this.debugAssets = !!conf.html.bx_component.debug_assets;
		this.useMinifiedCss = !!conf.html.bx_component.use_minified_css;
		this.useMinifiedJs = !!conf.html.bx_component.use_minified_js;
	}

	add(assetType, assetName, ctxNjk) {
		switch (assetType) {
			case 'css':
			case 'js':
				break;
			default:
				throw new Error('Argument "assetType" must be "css" or "js"');
		}
		const store = this[assetType];
		const fileName = assetName+'.'+assetType;
		const fileNameMin = assetName+'.min.'+assetType;
		let isMinified = (assetType === 'css')
			? this.useMinifiedCss
			: this.useMinifiedJs;
		let fileExists = false;
		let fileExistsMark = '[-]';
		let fileUrl = ctxNjk.templateUrl+'/'+(isMinified ? fileNameMin : fileName);
		let fileHref = fileUrl.replace(/@components/,
			( typeof(ctxNjk.CMP_BASE) != 'undefined' )
				? ctxNjk.CMP_BASE : 'components'
		).replace('\\', '/');
		let filePath = ctxNjk.templatePath+'/'+(isMinified ? fileNameMin : fileName);

		if (!ctxNjk.__PAGE__) {
			throw new Error('add bx_component asset error: current qubiti nunjucks page is unknown');
		}
		const currentPage = `${ctxNjk.HTML_SRC_BASE}/${ctxNjk.__PAGE__}`;

		if( typeof(store[currentPage]) == 'undefined' ) {
			store[currentPage] = [];
		}

		if( isMinified ) {
			if( store[currentPage].indexOf(fileHref) !== -1 ) {
				return;
			}
			if( fs.existsSync(filePath) ) {
				fileExists = true;
				fileExistsMark = '[+]';
			} else {
				fileUrl = ctxNjk.templateUrl+'/'+fileName;
				fileHref = fileUrl.replace(/@components/,
					( typeof(ctxNjk.CMP_BASE) != 'undefined' )
						? ctxNjk.CMP_BASE : 'components'
				);
				filePath = ctxNjk.templatePath+'/'+fileName;
				if( store[currentPage].indexOf(fileHref) !== -1 ) {
					return;
				}
				if( fs.existsSync(filePath) ) {
					fileExists = true;
					fileExistsMark = '[~]';
				}
			}
		} else {
			if( store[currentPage].indexOf(fileHref) !== -1 ) {
				return;
			}
			if( fs.existsSync(filePath) ) {
				fileExists = true;
				fileExistsMark = '[+]';
			}
		}

		if( this.debugAssets ) gutil.log(gutil.colors.blue(
			'bx_component asset '+assetType+(isMinified?'.min':'')+': '
			+fileExistsMark
			+` "${fileUrl.replace(/@components\//, '')}"`
			+`, page: "${currentPage}"`
		));
		if( fileExists ) {
			store[currentPage].push(fileHref);
		}
	}
}

// noinspection JSUnusedLocalSymbols
function parseNunjucksTag(parser, nodes, lexer) {
	// get the tag token
	let tok = parser.nextToken();
	let args = parser.parseSignature(null, true);
	if (args.children.length === 0) {
		args.addChild(new nodes.Literal(0, 0, ""));
	}
	parser.advanceAfterBlockEnd(tok.value);
	return new nodes.CallExtension(this, tok.value, args, []);
}
/**
 * Таким образом будет эмулироваться поведение компонентов битрикс
 * используем теги вида {% bx_component
 * 							name="bitrix:news.list"
 * 							template="main-page-list"
 * 							params={}
 * 							data={}
 * 							parent="@component"
 * 						%}
 *
 * @param {Object} qubitiConfig
 * @param {ComponentsAssets} assets
 * @param nunjucksEnvironment
 * @constructor
 */
function ComponentTag(qubitiConfig, assets, nunjucksEnvironment) {
	this.tags = ['bx_component'];
	this.parse = parseNunjucksTag;
	this.bx_component = function(context, args) {
		if (!context.ctx || !context.ctx.__PAGE__) {
			// Если в контексте нет компилируемой страницы,
			// значит файл был подключен через тег {% import %},
			// а не, например, {% include %}.
			// Это значит, что нет никакого смысла выполнять компоненты,
			// поскольку программисту надо просто
			// получить переменные и макросы из файла
			return '';
		}
		if( 'string' != typeof(args.name) ) {
			throw 'component name not set';
		}
		if( 'string' != typeof(args.template) ) {
			args.template = '.default';
		}
		args.parent = (typeof(args.parent) !== 'string') ? '' : args.parent;
		let name = args.name.replace(/:/, '/');
		let template = (args.template.length < 1) ? '.default' : args.template;
		let parent = '';
		if( 'string' == typeof(args.parent) && args.parent.length > 0 ) {
			parent = args.parent+'/';
		}
		let page = 'string' == typeof(args['complex_page'])
			? args['complex_page']
			:'string' == typeof(args['page'])
				? args['page']
				:'template';
		let ctx = extend({}, context.ctx);
		ctx.templateUrl = '@components/'+parent+name+'/'+template;
		ctx.templatePath = ctx.templateUrl.replace(/@components/, 'components');
		ctx.templateFolder = ( typeof(ctx.CMP_BASE) != 'undefined' )
			? ctx.templateUrl.replace(/@components/, ctx.CMP_BASE)
			: ctx.templatePath;
		let templateFilePath = ctx.templatePath+'/'+page+'.njk';
		if (! fs.existsSync(templateFilePath)) {
			throw 'bx_component error: component "'+name+'/'+template+'" template file not found'
			+' ('+templateFilePath+')';
		}

		assets.add('js', 'script', ctx);
		assets.add('css', 'style', ctx);

		// add params
		ctx.args = extend({}, args);
		if (typeof ctx.args.params !== 'undefined') {
			ctx.params = ctx.args.params;
		}

		// render bx_component
		// noinspection JSCheckFunctionSignatures
		let templateFileContent = this.readFile(qubitiConfig.curDir+'/'+templateFilePath, ctx);
		templateFileContent = templateFileContent.replace(
			/({%\s*bx_component[\s\S]+?)(parent=['"])(@component)(['"])/gm,
			'$1$2'+name+'/'+template+'$4'
		);
		if( qubitiConfig.html.bx_component.debug_show_component_files ) {
			gutil.log(gutil.colors.blue('render component file: '+templateFilePath));
		}
		return new nunjucks.runtime.SafeString(
			nunjucksEnvironment.renderString(
				templateFileContent, ctx,
				{ path: templateFilePath },
				// function() { debugger; }
			)
		);
	};

	this.readFile = function(filePath, rootCtx) {
		try {
			// используем файловый loader, встроенный в nunjucks
			let fileObj = nunjucksEnvironment.loaders[0].getSource(filePath);
			if (fileObj) {
				return fileObj.src;
			} else {
				console.log("error to load: " + filePath);
			}
		} catch (e) {
			console.log("error", e);
		}
		return null;
	};
}

class AddAsset {
	/**
	 * @param {ComponentsAssets} njkAsset
	 */
	constructor(njkAsset) {
		this.tags = ['bx_add_asset'];
		this.parse = parseNunjucksTag;
		this.njkAsset = njkAsset;
	}

	bx_add_asset(context, assetPath) {
		//console.log('context, args', context, args);
		if (typeof assetPath !== 'string') {
			throw new Error('bx_add_asset: argument should be a string');
		}
		if (!context.ctx || !context.ctx.__PAGE__) {
			throw new Error('{% bx_add_asset %}: error: current qubiti nunjucks page is unknown');
		}
		const pathMatches = assetPath.match(/^((?:[\w\-.]+\/|\.\/|\.\.\/)*[\w\-.]+)\.(\w+)$/);
		let assetType = undefined;
		if (pathMatches) {
			switch(['js', 'css', 'scss', 'less'].indexOf(pathMatches[2])) {
				case 0: assetType = 'js'; break;
				case 1:
				case 2:
				case 3: assetType = 'css'; break;
			}
		}
		if (!assetType) {
			throw new Error(`bx_add_asset: Unknown asset type for path: "${assetPath}"`);
		}
		this.njkAsset.add(assetType, pathMatches[1], context.ctx);
	}
}

/**
 * @constructor
 */
function ComponentAssetsCssPlaceHolder() {
	this.tags = ['bx_component_assets_css'];
	this.parse = parseNunjucksTag;
	// noinspection JSUnusedLocalSymbols
	this.bx_component_assets_css = function(context, args) {
		return new nunjucks.runtime.SafeString('<!-- @bx_component_assets_css -->');
	}
}

/**
 * @constructor
 */
function ComponentAssetsJsPlaceHolder() {
	this.tags = ['bx_component_assets_js'];
	this.parse = parseNunjucksTag;
	// noinspection JSUnusedLocalSymbols
	this.bx_component_assets_js = function(context, args) {
		return new nunjucks.runtime.SafeString('<!-- @bx_component_assets_js -->');
	}
}

function replaceAssetsPlaceHolders(assets) {
	return tap(function(file) {
		const currentPage = Path.relative(file.cwd, file.path)
			.replace(/\.html$/, '.njk');
		if( assets.debugAssets ) gutil.log(
			'commit assets to page '+gutil.colors.blue(`"${currentPage}"`)
		);
		let cssOut = '<!-- @bx_component_assets_css -->\n';
		if( currentPage
			&& Array.isArray(assets.css[currentPage])
			&& assets.css[currentPage].length > 0
		) {
			for(let iFile=0; iFile < assets.css[currentPage].length; iFile++) {
				let href = assets.css[currentPage][iFile];
				cssOut += '<link type="text/css" rel="stylesheet" href="'+href+'">\n';
			}
		}
		let jsOut = '<!-- @bx_component_assets_js -->\n';
		if( currentPage
			&& Array.isArray(assets.js[currentPage])
			&& assets.js[currentPage].length > 0
		) {
			for(let iFile=0; iFile < assets.js[currentPage].length; iFile++) {
				let href = assets.js[currentPage][iFile];
				jsOut += '<script type="text/javascript" src="'+href+'"></script>\n';
			}
		}
		file.contents = Buffer.from(file.contents.toString()
			.replace(/<!--[\s]*@bx_component_assets_css[\s]*-->(?:\r?\n)?/, cssOut)
			.replace(/<!--[\s]*@bx_component_assets_js[\s]*-->(?:\r?\n)?/, jsOut)
		);
	})
}

function injectData(conf, cssBundleFiles) {
	return data(function(file) {
		const __PAGE__ = utils.getRelFilePath(file.path, `${conf.curDir}/${conf.html.base}`);
		const __NAME__ = Path.basename(__PAGE__);
		const __PATH__ = Path.dirname(__PAGE__).replace(/\\/g, '/');
		const SITE_TEMPLATE_PATH = Path.relative(`/${conf.html.dest}/${__PATH__}`, '/').replace(/\\/g, '/');
		const DOCUMENT_ROOT = SITE_TEMPLATE_PATH;
		// const SITE_DIR = `${DOCUMENT_ROOT}/${conf.html.dest}/`;
		const SITE_DIR = (__PATH__ === '.') ? './' : Path.relative(`/${__PATH__}`, '/').replace(/\\/g, '/')+'/';
		const IMG_DIR = SITE_TEMPLATE_PATH+'/'+conf.images.common.dest;
		const CMP_BASE = SITE_TEMPLATE_PATH+'/components';
		return {
			PRODUCTION: conf.production,
			HTML_CHARSET: 'UTF-8',//conf.html.charset,
			HTML_SRC_BASE: conf.html.base,
			CSS_BUNDLE_FILES: cssBundleFiles,
			__PAGE__: __PAGE__,
			__PATH__: __PATH__,
			__NAME__: __NAME__,
			DOC_ROOT: DOCUMENT_ROOT,
			SITE_DIR: SITE_DIR,
			SITE_TEMPLATE_PATH: SITE_TEMPLATE_PATH,
			IMG_DIR: IMG_DIR,
			CMP_BASE: CMP_BASE
		};
	});
}

module.exports.ComponentTag = ComponentTag;
module.exports.ComponentsAssets = ComponentsAssets;
module.exports.ComponentAssetsCssPlaceHolder = ComponentAssetsCssPlaceHolder;
module.exports.ComponentAssetsJsPlaceHolder = ComponentAssetsJsPlaceHolder;
module.exports.AddAsset = AddAsset;
module.exports.replaceAssetsPlaceHolders = replaceAssetsPlaceHolders;
module.exports.injectData = injectData;
