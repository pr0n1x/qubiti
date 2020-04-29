const Path = require('path')
	,gutil = require('gulp-util');

function substr(f_string, f_start, f_length) {
	// Return part of a string
	//
	// +	 original by: Martijn Wieringa
	if(f_start < 0) {
		f_start += f_string.length;
	}
	if(f_length === undefined) {
		f_length = f_string.length;
	} else if(f_length < 0){
		f_length += f_string.length;
	} else {
		f_length += f_start;
	}
	if(f_length < f_start) {
		f_length = f_start;
	}
	return f_string.substring(f_start, f_length);
}

/**
 * @param {string} filePath
 * @param {string} currentDir
 * @returns {string}
 */
function getRelFilePath(filePath, currentDir) {
	if (filePath.indexOf(Path.sep) === 0 && filePath.indexOf(currentDir) !== 0) {
		throw 'Обращение к файлу лежащему за пределами собираемого шаблона!:'
		+'\n    Путь: '+filePath
		+'\n    Во избежание неожиданного поведения сборщика операция не допускается.';
	}
	filePath = Path.resolve(currentDir, filePath);
	return substr(filePath, currentDir.length+1);
}

function defineReferenceProperty(referenceGetter) {
	let selfValue = undefined;
	return {
		get: function() {
			return (typeof(selfValue) == 'undefined')
				? referenceGetter()
				: selfValue;
		},
		set: function(newSelfValue) {
			selfValue = newSelfValue;
		}
	};
}


/**
 *
 * @param {Object} object
 * @param {RegExp} search
 * @param {(boolean|string|number)} replace
 * @param {number} [callCount]
 */
function dereferencePlaceHolder(object, search, replace, callCount) {
	if (typeof(callCount) == 'undefined') callCount = 1;
	// noinspection JSCheckFunctionSignatures
	if (parseInt(callCount) <= 1) callCount = 1;
	if (typeof(object) != 'object') return;
	if(Array.isArray(object)) {
		for(let key=0; key < object.length; key++) {
			dereferenceItem(object, key, search, replace, callCount);
		}
	}
	else {
		for(let key in object) {
			if(object.hasOwnProperty(key)) {
				dereferenceItem(object, key, search, replace, callCount);
			}
		}
	}
}
function dereferenceItem(object, key, search, replace, callCount) {
	switch(typeof(object[key])) {
		case 'object':
			//onsole.log(offset+key+':object:'+callcount);
			dereferencePlaceHolder(object[key], search, replace, (callCount+1));
			break;
		case 'string':
			//onsole.log(offset+key+':string:'+callcount);
			object[key] = object[key].replace(search, replace);
			break;
		default:
			break;
	}
}

function parseArgAsBool(value) {
	if( typeof(value) == 'string' ) {
		value = value.trim().toUpperCase();
		switch(value) {
			case 'N':
			case 'NO':
			case 'FALSE':
			case 'OFF':
			case '0':
				return false;
		}
		return true;
	}
	return !!value;
}

function parsePath(path) {
	let extname = Path.extname(path);
	return {
		dirname: Path.dirname(path),
		basename: Path.basename(path, extname),
		extname: extname
	};
}

// "Проглатывает" ошибку, но выводит в терминал
function swallowError(error) {
	gutil.log(error);
	this.emit('end');
}


module.exports.substr = substr;
module.exports.getRelFilePath = getRelFilePath;
module.exports.defineReferenceProperty = defineReferenceProperty;
module.exports.dereferencePlaceHolder = dereferencePlaceHolder;
module.exports.parseArgAsBool = parseArgAsBool;
module.exports.parsePath = parsePath;
module.exports.swallowError = swallowError;
