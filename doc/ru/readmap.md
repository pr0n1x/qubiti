# Дорожная карта
1. Переписать watcher-ы для сборки бандла с gulp.watch на watchify browserify-hmr
2. Добавить поддержку scss
3. В сборку less/scss добавить отслеживание зависимостей файлов,
	дабы при изменении lib-файлов пересобирались только те стили,
	которые зависят от этих lib-файлов.