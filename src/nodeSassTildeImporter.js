/*
 * Кастомизированый модуль "node-sass-tilde-importer"
 * Причина:
 * если не указывать расширение файла, "node-sass-tilde-importer"
 * подключает "import-path/imported-file/index.scss"
 * вместо     "import-path/imported-file.scss"
 *
 * Из-за этого, например невозможно собрать кастомный bootstrap с использованием "~"
 */
const path = require('path');
const findParentDir = require('find-parent-dir');
const fs = require('fs');

function resolve(targetUrl, source) {
	const packageRoot = findParentDir.sync(source, 'node_modules');
	if (!packageRoot) {
		return null;
	}

	const filePath = path.resolve(packageRoot, 'node_modules', targetUrl);
	const dirName = path.dirname(filePath);
	const fileName = path.basename(filePath);
	const fileExt = path.extname(fileName);

	if (!fileExt && fs.existsSync(filePath)) {
		if (   fs.existsSync(`${dirName}/${fileName}.scss`)
			|| fs.existsSync(`${dirName}/_${fileName}.scss`)
			|| fs.existsSync(`${dirName}/${fileName}.sass`)
			|| fs.existsSync(`${dirName}/_${fileName}.sass`)
		) {
			return filePath;
		}
		return path.resolve(filePath, 'index');
	} else if (fs.existsSync(path.dirname(filePath))) {
		return filePath;
	}

	return resolve(targetUrl, path.dirname(packageRoot));
}

module.exports = function importer (url, prev, done) {
	return (url[ 0 ] === '~') ? { file: resolve(url.substr(1), prev) } : null;
};
