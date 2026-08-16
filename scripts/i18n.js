'use strict';

const fs = require('hexo-fs');
const path = require('path');
const pagination = require('hexo-pagination');

hexo.extend.filter.register('before_generate', function () {
  const config = hexo.config;
  const languages = Array.isArray(config.language) ? config.language : [config.language || 'default'];
  const defaultLang = languages[0] || 'vi';
  const posts = this.locals.get('posts');

  posts.forEach(post => {
    if (!post.lang) post.lang = defaultLang;
    if (post.lang === 'en' && !post.__permalink) {
      post.__permalink = 'en/' + path.basename(post.slug) + '/';
    }
  });

  hexo.extend.generator.register('index', function (locals) {
    const orderBy = config.index_generator.order_by || '-date';
    const perPage = config.index_generator.per_page || 10;
    const paginationDir = config.pagination_dir || 'page';
    const categories = locals.categories;

    const getTopcat = function (cat) {
      if (cat.parent) {
        const pCat = categories.findOne({ _id: cat.parent });
        return getTopcat(pCat);
      }
      return cat;
    };

    const buildIndex = function (lang, prefix) {
      const covers = [];
      const catlist = [];
      const nonDefault = languages.filter(l => l !== defaultLang);
      const cond = lang === defaultLang
        ? (nonDefault.length ? { lang: { $nin: nonDefault } } : {})
        : { lang: lang };

      const sticky = locals.posts.find(Object.assign({ sticky: true }, cond)).sort(orderBy);
      const posts = locals.posts.find(Object.assign({ sticky: { $exists: false } }, cond)).sort(orderBy);

      if (categories && categories.length) {
        categories.forEach(cat => {
          const langPosts = cat.posts.filter(p => (p.lang || defaultLang) === lang);
          if (langPosts.length === 0) return;

          const cover = 'source/_posts/' + cat.slug + '/cover.jpg';
          if (fs.existsSync(cover)) {
            covers.push({
              path: cat.slug + '/cover.jpg',
              data: function () {
                return fs.createReadStream(cover);
              }
            });

            const catCopy = Object.assign({}, cat, {
              path: cat.path,
              length: langPosts.length,
              subs: [],
              child: undefined,
              top: undefined
            });

            const topcat = getTopcat(cat);
            if (topcat._id != cat._id) catCopy.top = topcat;

            const child = categories.find({ parent: cat._id });
            let pl = 6;

            if (child.length != 0) {
              catCopy.child = child.length;
              catCopy.subs = child.sort({ name: 1 }).limit(6).toArray();
              pl = Math.max(0, pl - child.length);
              if (pl > 0) {
                catCopy.subs.push.apply(catCopy.subs, langPosts.filter(function (item) {
                  if (item.categories.last()._id == cat._id) return true;
                }).sort({ title: 1 }).limit(pl).toArray());
              }
            } else {
              catCopy.subs = langPosts.sort({ title: 1 }).limit(6).toArray();
            }

            catlist.push(catCopy);
          }
        });
      }

      const basePath = prefix || '';
      let pages;

      if (posts.length > 0) {
        pages = pagination(basePath, posts, {
          perPage: perPage,
          layout: ['index', 'archive'],
          format: paginationDir + '/%d/',
          data: {
            __index: true,
            catlist: catlist,
            sticky: sticky
          }
        });
      } else {
        pages = [{
          path: basePath,
          layout: ['index', 'archive'],
          data: {
            __index: true,
            catlist: catlist,
            sticky: sticky
          }
        }];
      }

      return [...covers, ...pages];
    };

    const results = buildIndex(defaultLang, '');

    for (const lang of languages.slice(1)) {
      results.push(...buildIndex(lang, lang + '/'));
    }

    return results;
  });
});

hexo.extend.helper.register('partial', function (name, locals, options = {}) {
  const { cache } = options;
  const viewDir = this.view_dir;
  const currentView = this.filename.substring(viewDir.length);
  const viewPath = path.join(path.dirname(currentView), name);
  const view = hexo.theme.getView(viewPath) || hexo.theme.getView(name);
  const viewLocals = { layout: false };

  if (!view) {
    throw new Error(`Partial ${name} does not exist. (in ${currentView})`);
  }

  if (options.only) {
    Object.assign(viewLocals, locals);
  } else {
    Object.assign(viewLocals, this, locals);
  }

  viewLocals.layout = false;

  if (cache) {
    const pageData = viewLocals.page || {};
    const lang = pageData.lang ? pageData.lang : 'default';
    const scope = pageData.__post ? ':' + pageData.path : '';
    const cacheId = (typeof cache === 'string' ? cache : view.path) + ':' + lang + scope;
    return this.fragment_cache(cacheId, () => view.renderSync(viewLocals));
  }

  return view.renderSync(viewLocals);
});

hexo.extend.filter.register('template_locals', function (locals) {
  const page = locals.page;
  if (!page) return locals;

  const config = hexo.config;
  const languages = Array.isArray(config.language) ? config.language : [config.language || 'default'];
  const defaultLang = languages[0] || 'vi';

  if (!page.language) {
    page.language = page.lang || defaultLang;
  }

  if (page.lang === 'en' && page.canonical_path !== locals.path) {
    page.canonical_path = locals.path;
  }

  if (locals.site && locals.site.posts) {
    const lang = page.lang || defaultLang;
    const filtered = lang === defaultLang
      ? locals.site.posts.find({ lang: { $nin: languages.filter(l => l !== defaultLang) } })
      : locals.site.posts.find({ lang: lang });
    locals.site = Object.assign({}, locals.site, { posts: filtered });
  }

  return locals;
}, 20);
