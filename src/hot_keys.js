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
		keyListener.on('optimizeImages', function() {
			runSequence(
				'--begin-interactive-mode-task-action', 'remove-watchers',
				'images',
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
    Горячие клавиши как правло не содержат нажатий Ctrl или Alt
    и срабатывают при нажатии непосредственно на одну целевую клавишу.
    Будьте аккуратны :)

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

module.exports.getHotKeysWatcher = getHotKeysWatcher;
module.exports.getKeysDebugger = getKeysDebugger;
module.exports.showHelpHotKeys = showHelpHotKeys;
