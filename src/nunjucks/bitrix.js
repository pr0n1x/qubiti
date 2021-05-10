const fs = require('fs')
	,Path = require('path')
	,extend = require('extend')
	,tap = require('gulp-tap')
	,gutil = require('gulp-util')
	,data = require('gulp-data')
	,utils = require('../utils')
	,nunjucks = require('nunjucks')
;

class AssetStorage {

	constructor(conf) {
		this.curDir = conf.curDir;
		this.js = [];
		this.css = [];
		this.debugAssets = !!conf.html.bx_component.debug_assets;
		this.useMinifiedCss = !!conf.html.bx_component.use_minified_css;
		this.useMinifiedJs = !!conf.html.bx_component.use_minified_js;
	}

	add(assetPath, ctxNjk) {
		if (!ctxNjk.__PAGE__) {
			throw new Error('bx_add_asset error: current qubiti nunjucks page is unknown');
		}
		const assetNameDotSplit = assetPath.split('.');
		const assetType = assetNameDotSplit[assetNameDotSplit.length - 1];
		switch (assetType) {
			case 'css':
			case 'js':
				break;
			default:
				throw new Error('Argument "assetType" must be "css" or "js"');
		}
		const store = this[assetType];
		const isForcedMin = (assetNameDotSplit.length > 2 && assetNameDotSplit[assetNameDotSplit.length-2] === 'min');
		const isMinified = (
			isForcedMin
			|| (
				(assetType === 'css')
					? this.useMinifiedCss
					: this.useMinifiedJs
			)
		);
		let filePath = (isMinified && !isForcedMin)
			? assetNameDotSplit.slice(0, -1).join('.')+'.min.'+assetType
			: assetPath;
		let fileExists = false;
		let fileExistsMark = '[-]';
		let fileUrl = ctxNjk.SITE_TEMPLATE_PATH+'/'+filePath;

		const currentPage = `${ctxNjk.HTML_SRC_BASE}/${ctxNjk.__PAGE__}`;

		if( typeof(store[currentPage]) == 'undefined' ) {
			store[currentPage] = [];
		}

		if( store[currentPage].indexOf(fileUrl) !== -1 ) {
			return;
		}
		if( fs.existsSync(filePath) ) {
			fileExists = true;
			fileExistsMark = '[+]';
		} else {
			const filePathMinInverse = isMinified
				? (isForcedMin
					? assetNameDotSplit.slice(0, -2).join('.')+'.'+assetType
					: assetPath
				)
				: assetNameDotSplit.slice(0, -1).join('.')+'.min.'+assetType;
			const fileUrlMinInverse = ctxNjk.SITE_TEMPLATE_PATH+'/'+filePathMinInverse;
			if( store[currentPage].indexOf(fileUrlMinInverse) !== -1 ) {
				return;
			}
			if( fs.existsSync(filePathMinInverse) ) {
				fileExists = true;
				fileExistsMark = '[~]';
				filePath = filePathMinInverse;
				fileUrl = fileUrlMinInverse;
			}
		}

		if( this.debugAssets ) gutil.log(gutil.colors.blue(
			'bx_component asset: '
			+`${fileExistsMark} "${filePath}", page: "${currentPage}"`
		));
		if( fileExists ) {
			store[currentPage].push(fileUrl);
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
 * @param {AssetStorage} assets
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

		assets.add(`${ctx.templatePath}/script.js`, ctx);
		assets.add(`${ctx.templatePath}/style.css`, ctx);

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
		// noinspection JSUnresolvedFunction
		return new nunjucks.runtime.SafeString(
			nunjucksEnvironment.renderString(
				templateFileContent, ctx,
				{ path: templateFilePath },
				// function() { debugger; }
			)
		);
	};

	this.readFile = function(filePath, _rootCtx) {
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
	 * @param {AssetStorage} njkAsset
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

		const fileDir = Path.dirname(assetPath);
		const fileName = Path.basename(assetPath);
		const fileNameDotSplit = fileName.split('.');
		let assetType = undefined;
		if (fileNameDotSplit.length > 1) {
			switch(['js', 'css', 'scss', 'less'].indexOf(fileNameDotSplit[fileNameDotSplit.length-1])) {
				case 0: assetType = 'js'; break;
				case 1:
				case 2:
				case 3: assetType = 'css'; break;
			}
		}
		if (!assetType) {
			throw new Error(`bx_add_asset: Unknown asset type for path: "${assetPath}"`);
		}
		const filePath = (fileDir === '.' ? '' : fileDir+'/')
			+fileNameDotSplit.slice(0, -1).join('.')
			+'.'+assetType;
		this.njkAsset.add(filePath, context.ctx);
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
		// noinspection JSUnresolvedFunction
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
		// noinspection JSUnresolvedFunction
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
module.exports.AssetStorage = AssetStorage;
module.exports.ComponentAssetsCssPlaceHolder = ComponentAssetsCssPlaceHolder;
module.exports.ComponentAssetsJsPlaceHolder = ComponentAssetsJsPlaceHolder;
module.exports.AddAsset = AddAsset;
module.exports.replaceAssetsPlaceHolders = replaceAssetsPlaceHolders;
module.exports.injectData = injectData;
