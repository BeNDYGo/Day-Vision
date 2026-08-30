const DEFAULT_COLORS = [
  '#77ae8a', // dark green
  '#cfe7bf', // light green
  '#d8a94f', // dark yellow
  '#f6e8a9', // light yellow
  '#b66f73', // dark red
  '#e29a96', // red
  '#9fc7dc', // blue
  '#c9b3dc', // purple
];

const apiParameter = new URLSearchParams(location.search).get('api');
if (apiParameter) localStorage.setItem('dayvision-api', apiParameter.replace(/\/$/, ''));
const API_ORIGIN = localStorage.getItem('dayvision-api') || 'http://localhost:8750';

const monthNames = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const monthNamesGenitive = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const weekdayNames = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

const calendar = document.querySelector('#calendar');
const editor = document.querySelector('#editor');
const palette = document.querySelector('#palette');
const photos = document.querySelector('#photos');
const tagInput = document.querySelector('#tag-input');
let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selected = new Date();
let entry = emptyEntry();
let entries = {};
let colors = DEFAULT_COLORS;
let deleteColors = false;
let savedRange = null;

function emptyEntry() { return { html: '', tags: [], color: '', photos: [] }; }
function dateKey(date) { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'); }
function contrast(hex) { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 135 ? '#fff' : '#25221d'; }

async function api(path, options = {}) {
  const url = `${API_ORIGIN}/api${path}`;
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { ...(options.body && { 'content-type': 'application/json' }), ...options.headers },
    });
  } catch {
    throw new Error(`Не удалось подключиться к API: ${API_ORIGIN}`);
  }
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Server error');
  return value;
}

async function loadMonth() {
  const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  entries = await api(`/month/${key}`);
}

async function saveEntry() {
  entry.html = sanitizeHtml(entry.html);
  entries[dateKey(selected)] = structuredClone(entry);
  await api(`/entries/${dateKey(selected)}`, { method: 'PUT', body: JSON.stringify(entry) });
}

async function selectDate(date) {
  selected = date;
  entry = structuredClone(entries[dateKey(date)] || emptyEntry());
  editor.innerHTML = entry.html;
  document.querySelector('#entry-date').textContent = `${date.getDate()} ${monthNamesGenitive[date.getMonth()]}, ${weekdayNames[date.getDay()]}`;
  renderTags();
  renderPhotos();
  renderPalette();
  renderCalendar();
}

function renderCalendar() {
  calendar.innerHTML = '';
  weekdays.forEach(day => calendar.insertAdjacentHTML('beforeend', `<div class="weekday">${day}</div>`));
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  for (let i = 0; i < offset; i++) calendar.append(document.createElement('span'));
  for (let day = 1; day <= days; day++) {
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    const button = document.createElement('button');
    button.className = 'day';
    button.type = 'button';
    button.textContent = day;
    button.setAttribute('aria-pressed', String(dateKey(date) === dateKey(selected)));
    const saved = entries[dateKey(date)];
    if (saved?.color) {
      button.style.background = saved.color;
      button.style.color = contrast(saved.color);
    }
    button.addEventListener('click', () => selectDate(date));
    calendar.append(button);
  }
  document.querySelector('#month-title').textContent = `${monthNames[month.getMonth()]} ${month.getFullYear()}`;
}

function renderPalette() {
  palette.innerHTML = '';
  colors.forEach(color => {
    const button = document.createElement('button');
    button.className = 'swatch';
    button.type = 'button';
    button.style.background = color;
    button.setAttribute('aria-label', `Цвет ${color}`);
    button.setAttribute('aria-pressed', String(entry.color === color));
    button.addEventListener('click', async () => {
      if (deleteColors) {
        colors = colors.filter(value => value !== color);
        await api('/palette', { method: 'PUT', body: JSON.stringify(colors) });
        renderPalette();
        return;
      }
      entry.color = color;
      await saveEntry();
      renderPalette();
      renderCalendar();
    });
    palette.append(button);
  });
  palette.classList.toggle('deleting', deleteColors);
}

function renderTags() {
  const container = document.querySelector('#tags');
  container.innerHTML = '';
  entry.tags.forEach((tag, index) => {
    const chip = document.createElement('span');
    chip.className = 'tag';
    chip.textContent = `#${tag}`;
    const remove = document.createElement('button');
    remove.className = 'remove-tag';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Удалить #${tag}`);
    remove.addEventListener('click', async () => {
      entry.tags.splice(index, 1);
      await saveEntry();
      renderTags();
    });
    chip.append(remove);
    container.append(chip);
  });
}

function renderPhotos() {
  photos.innerHTML = '';
  entry.photos.forEach((src, index) => {
    const frame = document.createElement('div');
    frame.className = 'photo';
    frame.innerHTML = `<img src="${src}" alt="Фотография за день">`;
    const remove = document.createElement('button');
    remove.className = 'remove-photo';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Удалить фотографию');
    remove.addEventListener('click', async () => {
      entry.photos.splice(index, 1);
      await saveEntry();
      renderPhotos();
    });
    frame.append(remove);
    photos.append(frame);
  });
}

function insideEditor(node) { return node && (node === editor || editor.contains(node)); }
function ancestor(node, tag) { for (let current = node?.nodeType === 3 ? node.parentElement : node; current && current !== editor; current = current.parentElement) if (current.tagName === tag.toUpperCase()) return current; return null; }
function replaceTag(old, tag) { const next = document.createElement(tag); while (old.firstChild) next.append(old.firstChild); old.replaceWith(next); return next; }
function selectContents(node) { const range = document.createRange(); range.selectNodeContents(node); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); savedRange = range.cloneRange(); editor.focus(); updateToolbar(node); }
function updateToolbar(node) { document.querySelectorAll('[data-format]').forEach(button => button.setAttribute('aria-pressed', String(Boolean(ancestor(node, button.dataset.format === 'ul' ? 'li' : button.dataset.format))))); }

function toggleInline(tag) {
  if (!savedRange || savedRange.collapsed) return;
  const current = ancestor(savedRange.commonAncestorContainer, tag);
  if (current) {
    const parent = current.parentNode;
    const first = current.firstChild;
    const last = current.lastChild;
    while (current.firstChild) parent.insertBefore(current.firstChild, current);
    current.remove();
    const range = document.createRange();
    range.setStartBefore(first);
    range.setEndAfter(last);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    savedRange = range.cloneRange();
  } else {
    const wrapper = document.createElement(tag);
    wrapper.append(savedRange.extractContents());
    savedRange.insertNode(wrapper);
    selectContents(wrapper);
  }
  updateEntryText();
}

function toggleBlock(tag) {
  if (!savedRange) return;
  let node = savedRange.startContainer.nodeType === 3 ? savedRange.startContainer.parentElement : savedRange.startContainer;
  let current = node === editor ? null : node.closest('div,h3,blockquote,li');
  if (!current || !insideEditor(current)) {
    current = document.createElement('div');
    current.append(savedRange.extractContents());
    savedRange.insertNode(current);
  }
  let result;
  if (tag === 'ul') {
    if (current.tagName === 'LI') {
      const list = current.parentElement;
      const fragment = document.createDocumentFragment();
      [...list.children].forEach(item => {
        const div = document.createElement('div');
        while (item.firstChild) div.append(item.firstChild);
        if (item === current) result = div;
        fragment.append(div);
      });
      list.replaceWith(fragment);
    } else {
      const list = document.createElement('ul');
      const item = document.createElement('li');
      while (current.firstChild) item.append(current.firstChild);
      list.append(item);
      current.replaceWith(list);
      result = item;
    }
  } else result = replaceTag(current, current.tagName === tag.toUpperCase() ? 'div' : tag);
  selectContents(result);
  updateEntryText();
}

async function updateEntryText() {
  entry.html = editor.innerHTML;
  await saveEntry();
}

function sanitizeHtml(html) {
  const document = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const allowed = new Set(['DIV', 'BR', 'STRONG', 'EM', 'H3', 'BLOCKQUOTE', 'UL', 'LI']);
  for (const element of [...document.body.querySelectorAll('*')]) {
    if (!allowed.has(element.tagName)) element.replaceWith(...element.childNodes);
    else [...element.attributes].forEach(attribute => element.removeAttribute(attribute.name));
  }
  return document.body.firstElementChild?.innerHTML || '';
}

async function moveMonth(offset) {
  month = new Date(month.getFullYear(), month.getMonth() + offset, 1);
  selected = new Date(month);
  await loadMonth();
  selectDate(selected);
}

document.querySelector('#previous-month').addEventListener('click', () => moveMonth(-1));
document.querySelector('#next-month').addEventListener('click', () => moveMonth(1));
editor.addEventListener('input', updateEntryText);
document.addEventListener('selectionchange', () => { const selection = getSelection(); if (selection.rangeCount && insideEditor(selection.anchorNode)) { savedRange = selection.getRangeAt(0).cloneRange(); updateToolbar(selection.anchorNode); } });
document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('mousedown', event => { event.preventDefault(); ['strong', 'em'].includes(button.dataset.format) ? toggleInline(button.dataset.format) : toggleBlock(button.dataset.format); }));

tagInput.addEventListener('keydown', async event => {
  if (event.key !== 'Enter' || !tagInput.value.trim()) return;
  entry.tags.push(tagInput.value.trim().replace(/^#/, ''));
  tagInput.value = '';
  await saveEntry();
  renderTags();
});

document.querySelector('#photo-input').addEventListener('change', async event => {
  const files = [...event.target.files];
  entry.photos.push(...await Promise.all(files.map(file => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); }))));
  event.target.value = '';
  await saveEntry();
  renderPhotos();
});

document.querySelector('#color-input').addEventListener('change', event => {
  const color = event.target.value;
  if (!colors.includes(color)) colors.push(color);
  api('/palette', { method: 'PUT', body: JSON.stringify(colors) }).catch(showError);
  renderPalette();
});

document.querySelector('#delete-color').addEventListener('click', event => {
  deleteColors = !deleteColors;
  event.currentTarget.setAttribute('aria-pressed', String(deleteColors));
  renderPalette();
});

function showError(error) {
  console.error(error);
  alert(error.message);
}

selectDate(selected);
Promise.all([loadMonth(), api('/palette').then(value => { colors = value; })]).then(() => selectDate(selected)).catch(showError);
