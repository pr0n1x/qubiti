module.exports = {
	svgz: curDir => {
		const Path = require('path'), fs = require('fs');
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
				const fileFullPath = Path.resolve(curDir, '.' + req.url);
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
	},
	lampCharset: charset => {
		const iconv = require('iconv-lite')
		/**
		 * Эта мидлварь используется для проксирования к lamp-стеку
		 * для отладки интегрированнойго сайта например на мобильном телефоне.
		 * Если при этом инсталляция Битрикс выполнена в кодировке cp1251,
		 * то необходимо преобразовать кодировку, поскольку browserSync
		 * наотрез отказывется отдавать windows-1251 в бразуер.
		 * Перекодируем ответ из windows-1251 в utf-8 и меняем
		 * все соответсвующие загловки http-ответа и html-тела.
		 * @param req
		 * @param res
		 * @param {function()} next
		 */
		return function browserSyncMiddlewareLampCharset(req, res, next) {
			const end = res.end
				, write = res.write;
			let isHeaderWritten = false;
			const isUtf = 0 === charset.toLowerCase().indexOf('utf');
			function setHeaders() {
				if (!isHeaderWritten) {
					res.setHeader('Content-Type', 'text/html; charset=UTF-8');
					isHeaderWritten = true;
				}
			}
			res.write = (content, ...args) => {
				res.write = write;
				if (!isUtf && 0 === (''+res.getHeader('content-type')).indexOf('text/html')) {
					content = iconv.decode(content, charset)
						.replace(/(<meta.*?charset=")[\w\-]+(".*?>)/gim, `$1UTF-8$2`)
						.replace(/(<meta.*?http-equiv="Content-Type".*?content="text\/html; charset=)[\w\-]+(".*?>)/gim, `$1UTF-8$2`);
					setHeaders();
					return res.write(Buffer.from(content));
				}
				return res.write(content, ...args);
			};
			res.end = () => {
				res.end = end;
				if (!isUtf && !isHeaderWritten
					&& 0 === (''+res.getHeader('content-type')).indexOf('text/html')
				) { setHeaders(); }
				return res.end();
			};
			next();
		}
	}
}
