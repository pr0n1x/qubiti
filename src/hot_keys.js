const KeyPressEmitter = require('./KeyPressEmitter')
	,gutil = require('gulp-util');

function getHotKeysWatcher(conf, state, runSequence) {
	return function() {

		let keyListener = new KeyPressEmitter();

		keyListener.on('showHotKeysHelp', function() {
			runSequence('help-hk');
		});
		keyListener.on('showHelp', function() {
			runSequence('help');
		});
		keyListener.on('reloadWatchers', function() {
			if( state.watchers.length > 0 ) {
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
				'js-bundles',
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
		keyListener.on('optimizeCommonImages', function() {
			runSequence(
				'--begin-interactive-mode-task-action', 'remove-watchers',
				'images:main',
				'--finish-interactive-mode-task-action', 'add-watchers'
			);
		});
		keyListener.on('optimizeComponentImages', function() {
			runSequence(
				'--begin-interactive-mode-task-action', 'remove-watchers',
				'images:components',
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
		keyListener.on('switchVerboseMode', function() {
			conf.verbose = !conf.verbose;
			gutil.log(gutil.colors.magenta('Debug mode switched to "'+(conf.verbose?'true':'false')+'"'))
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
	};
}





function getKeysDebugger(state) {
	return function() {
		state.isInteractiveMode = true;
		let keyListener = new KeyPressEmitter();
		keyListener.debug = true;
		keyListener.start();
	};
}

function showHelpHotKeys(done) {
	console.log(`
       [F1] - Вывести эту справку
        [q] - Выход. Завершает интерактивный режим.
 [Ctrl + c] - Выход. Аналог [q].
        [w] - Перезагрузить watcher-ы. Полезно при добавлении новых файлов / компонентов,
              о которых gulp.watch пока не знает.
[Shift + w] - Удалить watcher-ы, дабы произвести удаление или перемещение файлов и папок.
              Полезно при активном перестроении структуры файлов и папок, когда
              gulp.watch запускает очень много сборок при таких действиях.
              Для повторного запуска нажмите "w".
        [r] - Более масштабная перегрузка watcher-ов включающая пересборку html, precss и js
              Это необходимо например потому, что тот же html зависит от состава файлов css-bundle-а.
              При создании новых компонентов и шаблонов необходимо использовать именно этот вариант.
[Shift + d] - Переключить debug-mode в противоположный.
              Так же управляется аргументом "--dbg".
[Shift + p] - Переключить production-mode.
              Так же управляется аргументом "--production".
        [h] - Сборка njk-файлов в html. Аналог $ gulp html
        [s] - Сборка основных стилей.
              Аналог $ gulp precss-main
[Shift + s] - Сборка основных стилей и их css-bundle-а
              Аналог $ gulp precss-main-bundle
        [a] - Сборка всех стилей (основных + компонентов, но без сборки bundle-а).
              Аналог $ gulp precss-main && gulp precss-components
[Shift + a] - Полный сборка всех стилей: компоненты, основные стили + bundle.
              Аналог $ gulp precss
        [l] - Соберет только precss-файлы компонентов (component/ns/name/tpl/style.(less|scss)).
              Аналог $ gulp precss-components
        [k] - Сборка только css-bundle-а.
              Аналог $ gulp css-bundle
        [j] - Сборка js-bundle(ов).
              Аналог $ gulp js-bundles
              из sources/js/<bundle_name>.js -> js/bundle.<bundle_name>[.min].js
[Shift + j] - Обработка всех скриптов кроме js-bundle-ов,
              в т.ч. для файлов script.js в компонентах
              Аналог $ gulp js-scripts
  [Alt + j] - Полная обработка js-файлов в т.ч. создание js-bundle-ов
              Аналог $ gulp js
        [i] - Минификация всех картинок (общих и компонентов)
              Аналог $ gulp images
    [Alt+i] - Минификация картинок в папке source/images
              и размещение оптимизированных в images/
              Аналог $ gulp images:main
  [Shift+i] - Минификация картинок в папках компонентов
              картинки из img.src/ оптимизируются и сохраняются в images/
              Пр.: "components/bitrix/news.list/.default/{img.src -> images}/rel/path/to/bg.png".
              Аналог $ gulp images:components
        [u] - Производит сборку спрайтов.
              Аналог $ gulp sprites
        [f] - Сборка svg-файлов в иконочный шрифт
              Аналог $ gulp svg-icons-font
        [g] - Загрузка шрифтов google-web-fonts (fonts.google.com)
              Аналог $ gulp google-web-fonts
              Загрузка повлечет за собой создание precss-файлов, на которые
              настроен watcher, соответственно будут пересобраны все precss-файлы $ gulp precss
        [b] - Полная сборка проекта. Аналог $ gulp build
`);
	done();
}

module.exports.getHotKeysWatcher = getHotKeysWatcher;
module.exports.getKeysDebugger = getKeysDebugger;
module.exports.showHelpHotKeys = showHelpHotKeys;
