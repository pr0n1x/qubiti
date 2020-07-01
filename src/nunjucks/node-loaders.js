/* eslint-disable no-console */
'use strict';

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const Loader = require('nunjucks/src/loader');
const _require = require('nunjucks/src/precompiled-loader.js');
const PrecompiledLoader = _require.PrecompiledLoader;
let chokidar;

const FileSystemLoader = /*#__PURE__*/function (_Loader) {
	_inheritsLoose(FileSystemLoader, _Loader);

	function FileSystemLoader(searchPaths, opts) {
		const _this = _Loader.call(this) || this;

		if (typeof opts === 'boolean') {
			console.log('[nunjucks] Warning: you passed a boolean as the second ' + 'argument to FileSystemLoader, but it now takes an options ' + 'object. See http://mozilla.github.io/nunjucks/api.html#filesystemloader');
		}

		opts = opts || {};
		_this.pathsToNames = {};
		_this.noCache = !!opts.noCache;
		_this.encoding = (typeof opts.encoding === 'string') ? opts.encoding : 'UTF-8';

		if (searchPaths) {
			searchPaths = Array.isArray(searchPaths) ? searchPaths : [searchPaths]; // For windows, convert to forward slashes
			_this.searchPaths = searchPaths.map(path.normalize);
		} else {
			_this.searchPaths = ['.'];
		}

		if (opts.watch) {
			// Watch all the templates in the paths and fire an event when
			// they change
			try {
				chokidar = require('chokidar'); // eslint-disable-line global-require
			} catch (e) {
				throw new Error('watch requires chokidar to be installed');
			}
			let paths = _this.searchPaths.filter(fs.existsSync);
			let watcher = chokidar.watch(paths);
			watcher.on('all', function (event, fullname) {
				fullname = path.resolve(fullname);

				if (event === 'change' && fullname in _this.pathsToNames) {
					_this.emit('update', _this.pathsToNames[fullname], fullname);
				}
			});
			watcher.on('error', function (error) {
				console.log('Watcher error: ' + error);
			});
		}
		return _this;
	}

	let _proto = FileSystemLoader.prototype;

	_proto.getSource = function getSource(name) {
		let fullpath = null;
		let paths = this.searchPaths;

		for (let i = 0; i < paths.length; i++) {
			let basePath = path.resolve(paths[i]);
			let p = path.resolve(paths[i], name); // Only allow the current directory and anything
			// underneath it to be searched

			if (p.indexOf(basePath) === 0 && fs.existsSync(p)) {
				fullpath = p;
				break;
			}
		}

		if (!fullpath) {
			return null;
		}

		this.pathsToNames[fullpath] = name;
		const bufSource = fs.readFileSync(fullpath);
		const source = {
			src: (this.encoding.toLowerCase() !== 'utf-8')
				? iconv.encodingExists(this.encoding)
					? iconv.decode(bufSource, this.encoding)
					: bufSource.toString()
				: bufSource.toString(),
			path: fullpath,
			noCache: this.noCache
		};
		this.emit('load', name, source);
		return source;
	};

	return FileSystemLoader;
}(Loader);

const NodeResolveLoader = /*#__PURE__*/function (_Loader2) {
	_inheritsLoose(NodeResolveLoader, _Loader2);

	function NodeResolveLoader(opts) {
		var _this2;

		_this2 = _Loader2.call(this) || this;
		opts = opts || {};
		_this2.pathsToNames = {};
		_this2.noCache = !!opts.noCache;
		_this.encoding = (typeof opts.encoding === 'string') ? opts.encoding : 'UTF-8';

		if (opts.watch) {
			try {
				chokidar = require('chokidar'); // eslint-disable-line global-require
			} catch (e) {
				throw new Error('watch requires chokidar to be installed');
			}

			_this2.watcher = chokidar.watch();

			_this2.watcher.on('change', function (fullname) {
				_this2.emit('update', _this2.pathsToNames[fullname], fullname);
			});

			_this2.watcher.on('error', function (error) {
				console.log('Watcher error: ' + error);
			});

			_this2.on('load', function (name, source) {
				_this2.watcher.add(source.path);
			});
		}

		return _this2;
	}

	let _proto2 = NodeResolveLoader.prototype;

	_proto2.getSource = function getSource(name) {
		// Don't allow file-system traversal
		if (/^\.?\.?(\/|\\)/.test(name)) {
			return null;
		}

		if (/^[A-Z]:/.test(name)) {
			return null;
		}

		let fullpath;

		try {
			fullpath = require.resolve(name);
		} catch (e) {
			return null;
		}

		this.pathsToNames[fullpath] = name;
		const bufSource = fs.readFileSync(fullpath);
		const source = {
			src: (this.encoding.toLowerCase() !== 'utf-8')
				? iconv.encodingExists(this.encoding)
					? iconv.decode(bufSource, this.encoding)
					: bufSource.toString()
				: bufSource.toString(),
			path: fullpath,
			noCache: this.noCache
		};
		this.emit('load', name, source);
		return source;
	};

	return NodeResolveLoader;
}(Loader);

module.exports = {
	FileSystemLoader: FileSystemLoader,
	PrecompiledLoader: PrecompiledLoader,
	NodeResolveLoader: NodeResolveLoader
};
