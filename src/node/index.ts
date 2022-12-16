import * as fs from 'fs'
import {Dirent} from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';
import {JSDOM} from 'jsdom';

const ROOT_DIR = `${__dirname}/../../..`;
const POEMS_DIR = `${ROOT_DIR}/resources/poems`;
const SLIDES_DIR = `${ROOT_DIR}/resources/slides`;

const MD_HTML = `
<!DOCTYPE html>
<html>
<head>
</head>
<body>
</body>
</html>
`;

type EntryName<T> = (string | T)[];
interface Entries extends EntryName<Entries> {};

async function deepReadDir(dirPath: string): Promise<Entries> {
  const dirents = await fs.promises.readdir(dirPath, {withFileTypes: true});
  return await Promise.all(dirents.map(async (dirent: Dirent) => {
    const current = path.join(dirPath, dirent.name);
    if (dirent.isDirectory()) {
      return await deepReadDir(current);
    } else {
      return current;
    }
  }));
}

function md2html(file: string): {file: string, html: string} {
  let html = '';
  if (fs.existsSync(file)) {
    const mdName = path.parse(file).name;
    const title = mdName.substring(4); // remove the leading xxx.
    const content = fs.readFileSync(file, {encoding: 'utf-8'});
    const md = new MarkdownIt();
    const fragment = md.render(content);
    const dom = new JSDOM(MD_HTML);
    const $ = require('jquery')(dom.window);
    $('head').append(`<title>${title}</title>\n`);
    $('body').append(fragment);
    html = `<!DOCTYPE html>
<html>
${$('html').html()}
</html>`;
  }
  return {
    file: file,
    html: html
  };
}

// poems
async function generateHtml() {
  const files = (await deepReadDir(POEMS_DIR)).flat(100);
  console.log(files);

  files.filter((fullname: string) => fullname.endsWith('.md'))
    .map((fullname: string) => md2html(fullname)).forEach((result) => {
      const mdPath = path.parse(result.file);
      const htmlPath = path.join(mdPath.dir, mdPath.name + '.html');
      fs.writeFileSync(htmlPath, result.html);
    });
}

async function generateLinks() {
  const poems = (await deepReadDir(POEMS_DIR)).flat(100);
  const result = poems.filter((fullname: string) => fullname.endsWith('.html'))
    .map((fullname: string) => {
      const filename = path.parse(fullname).name;
      const title = filename.substring(4); // remove the leading xxx.
      return {
        title: title,
        link: path.relative(ROOT_DIR, fullname)
      }
    });

  const slides = (await deepReadDir(SLIDES_DIR)).flat(100);
  const merged = result.concat(slides.filter((fullname: string) => fullname.endsWith('.js'))
    .map((fullname: string) => {
      const filename = path.parse(fullname).name;
      const filedir = path.parse(fullname).dir;
      return {
        title: filename,
        link: path.relative(ROOT_DIR, filedir) + `/index.html#${filename}`
      }
    }));

    return merged;
}

async function generateIndex() {
  const links = await generateLinks();

  const dom = new JSDOM(MD_HTML);
  const $ = require('jquery')(dom.window);

  $('body').append('<div><ul>' + 
    links.reduce((prev, curr) =>
      prev + `<li><a href="${curr.link}" target="_blank">${curr.title}</a></li>\n`
    , '\n')
     + '</ul></div>\n'
  );

  const html = `<!DOCTYPE html>
<html>
${$('html').html()}
</html>`;

    fs.writeFileSync(`${ROOT_DIR}/index.html`, html);
}

async function update() {
  await generateHtml();
  await generateIndex();
}

(async () => {
  await update();
})();


