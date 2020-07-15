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
		this.currentPage = null;
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
		);
		let filePath = ctxNjk.templatePath+'/'+(isMinified ? fileNameMin : fileName);
		if( typeof(store[this.currentPage]) == 'undefined' ) {
			store[this.currentPage] = [];
		}

		if( isMinified ) {
			if( store[this.currentPage].indexOf(fileHref) !== -1 ) {
				return;
			}
			if( fs.existsSync(filePath) ) {
				fileExists = true;
				fileExistsMark = '[+]';
			}
			else {
				debugger;
				fileUrl = ctxNjk.templateUrl+'/'+fileName;
				fileHref = fileUrl.replace(/@components/,
					( typeof(ctxNjk.CMP_BASE) != 'undefined' )
						? ctxNjk.CMP_BASE : 'components'
				);
				filePath = ctxNjk.templatePath+'/'+fileName;
				if( store[this.currentPage].indexOf(fileHref) !== -1 ) {
					return;
				}
				if( fs.existsSync(filePath) ) {
					fileExists = true;
					fileExistsMark = '[~]';
				}
			}
		}
		else {
			if( store[this.currentPage].indexOf(fileHref) !== -1 ) {
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
			+' "'+fileUrl.replace(/@components\//, '')+'"'
			+' (in file '+this.currentPage+')'
		));
		if( fileExists ) {
			store[this.currentPage].push(fileHref);
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
		if (null === assets.currentPage) {
			throw 'bx_component error: current nunjucks template unknown';
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
			nunjucksEnvironment.renderString(templateFileContent, ctx)
		);
	};

	this.readFile = function(filePath, rootCtx) {
		try {
			// используем файловый лоадер, встроенный в nunjucks
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
		let cssOut = '<!-- @bx_component_assets_css -->\n';
		if( null !== assets.currentPage
			&& typeof(assets.css[assets.currentPage]) != 'undefined'
			&& assets.css[assets.currentPage].length > 0
		) {
			for(let iFile=0; iFile < assets.css[assets.currentPage].length; iFile++) {
				let href = assets.css[assets.currentPage][iFile];
				cssOut += '<link type="text/css" rel="stylesheet" href="'+href+'">\n';
			}
		}
		let jsOut = '<!-- @bx_component_assets_js -->\n';
		if( null !== assets.currentPage
			&& typeof(assets.js[assets.currentPage]) != 'undefined'
			&& assets.js[assets.currentPage].length > 0
		) {
			for(let iFile=0; iFile < assets.js[assets.currentPage].length; iFile++) {
				let href = assets.js[assets.currentPage][iFile];
				jsOut += '<script type="text/javascript" src="'+href+'"></script>\n';
			}
		}
		file.contents = Buffer.from(file.contents.toString()
			.replace(/<!--[\s]*@bx_component_assets_css[\s]*-->\n?/, cssOut)
			.replace(/<!--[\s]*@bx_component_assets_js[\s]*-->\n?/, jsOut)
		);
	})
}

function injectData(conf, cssBundleFiles) {
	return data(function(file) {

		const currentFile = utils.getRelFilePath(file.path, `${conf.curDir}/${conf.html.base}`);
		const currentDir = Path.dirname(currentFile);
		const layoutDocumentRoot = Path.relative('/'+conf.html.dest, '/');
		const layoutSiteTemplatePath = layoutDocumentRoot;
		const layoutSiteDir = layoutDocumentRoot+'/'+conf.html.dest+'/';
		const layoutImagesDir = layoutSiteTemplatePath+'/'+conf.images.common.dest;
		const layoutComponentsBase = layoutSiteTemplatePath+'/components';
		return {
			PRODUCTION: conf.production,
			HTML_CHARSET: 'UTF-8',//conf.html.charset,
			HTML_SRC_BASE: conf.html.base,
			CSS_BUNDLE_FILES: cssBundleFiles,
			__PAGE__: currentFile,
			__PATH__: currentDir,
			DOC_ROOT: layoutDocumentRoot,
			SITE_DIR: layoutSiteDir,
			SITE_TEMPLATE_PATH: layoutSiteTemplatePath,
			IMG_DIR: layoutImagesDir,
			CMP_BASE: layoutComponentsBase
		};
	});
}

module.exports.ComponentTag = ComponentTag;
module.exports.ComponentsAssets = ComponentsAssets;
module.exports.ComponentAssetsCssPlaceHolder = ComponentAssetsCssPlaceHolder;
module.exports.ComponentAssetsJsPlaceHolder = ComponentAssetsJsPlaceHolder;
module.exports.replaceAssetsPlaceHolders = replaceAssetsPlaceHolders;
module.exports.injectData = injectData;
