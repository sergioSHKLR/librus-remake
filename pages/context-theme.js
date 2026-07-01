(function () {
  var theme = new URLSearchParams(location.search).get('theme');
  if (theme !== 'light' && theme !== 'dark') theme = 'system';
  document.documentElement.className = 'theme--' + theme;
})();