const Path = require('path')
	, fs = require('fs');

module.exports = conf => {
	/**
	 * При обращении к svg-файлу
	 * при наличии на ФС сжатой (svgz-версии)
	 * отдаем именно сжатую версию
	 * @param req
	 * @param res
	 * @param next
	 */
	return function browserSyncMiddlewareSvgz(req, res, next) {
		const extname = Path.extname(req.url);
		if ('.svg' === extname) {
			const fileFullPath = Path.resolve(conf.curDir, '.' + req.url);
			const compressedFullPath = fileFullPath + 'z';
			if (fs.existsSync(compressedFullPath)) {
				const end = res.end
					, write = res.write;
				const compressedFileContent = fs.readFileSync(compressedFullPath);
				// res.data = compressedFileContent;
				let isWritten = false;
				function setHeaders() {
					res.setHeader('Content-Length', compressedFileContent.length);
					res.setHeader('Content-Encoding', 'gzip');
				}
				res.write = (content, ...args) => {
					isWritten = true;
					setHeaders();
					res.write = write;
					return res.write(compressedFileContent, ...args);
				};
				res.end = () => {
					if (!isWritten) setHeaders();
					res.end = end;
					return res.end();
				};
			}
		} else if ('.svgz' === extname) {
			res.setHeader('Content-Encoding', 'gzip');
		}
		next();
	}
};
