// replace-icons.js  (FINAL)
const fs = require('fs');

let content = fs.readFileSync('js/main.js', 'utf8');

const replacements = {
  // Icons
  '\\uE313': '<img src="icons/expand.svg" alt="Expand" width="24" height="24" aria-hidden="true">',
  '\\uE5D5': '<img src="icons/refresh.svg" alt="Reload" width="24" height="24" aria-hidden="true">',
  '\\uE5CD': '<img src="icons/close.svg" alt="Stop" width="24" height="24" aria-hidden="true">',
  '\\uE244': '<img src="icons/quote.svg" alt="Jump" width="24" height="24" aria-hidden="true">',
  '\\uE15E': '<img src="icons/reply.svg" alt="Reply" width="24" height="24" aria-hidden="true">',
  '\\uE80D': '<img src="icons/share.svg" alt="Share" width="24" height="24" aria-hidden="true">',
  '\\uE872': '<img src="icons/delete.svg" alt="Delete" width="24" height="24" aria-hidden="true">',
  '\\uF106': '<img src="icons/wikipedia.svg" alt="Wikipedia" width="24" height="24" aria-hidden="true">',
  '\\uF385': '<img src="icons/dictionary.svg" alt="Dictionary" width="24" height="24" aria-hidden="true">',
  '\\uF3CA': '<img src="icons/map.svg" alt="Map" width="24" height="24" aria-hidden="true">',
  '\\uE2C1': '<img src="icons/offline.svg" alt="Offline" width="24" height="24" aria-hidden="true">',
  '\\uF15C': '<img src="icons/online.svg" alt="Online" width="24" height="24" aria-hidden="true">',

  // Punctuation
  '\\u201C': '"',
  '\\u201D': '"',
  '\\u2018': "'",
  '\\u2019': "'",
  '\\u2014': '—',
  '\\u2026': '…',     // ellipsis
};

Object.keys(replacements).forEach(old => {
  const regex = new RegExp(old.replace(/\\/g, '\\\\'), 'g');
  content = content.replace(regex, replacements[old]);
});

fs.writeFileSync('js/main.js', content);
console.log('✅ All code points replaced — zero left!');