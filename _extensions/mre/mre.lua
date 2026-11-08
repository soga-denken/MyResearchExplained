-- mre.lua
-- 1. Loads the web fonts (preconnect + stylesheet) and mre.js on every HTML page.
-- 2. Passes the `mre:` options from _quarto.yml to mre.js as window.MRE_CONFIG.
-- 3. Writes JSON-LD structured data: WebSite on the home page, Article on
--    pages that set `article-type` in their front matter.

local FONTS = [[
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Source+Sans+3:wght@400;600;700&display=swap">
]]

local function plain(v)
  if v == nil then return nil end
  local t = pandoc.utils.type(v)
  if t == "boolean" or t == "number" then return v end
  if t == "string" or t == "Inlines" or t == "Blocks" then
    return pandoc.utils.stringify(v)
  end
  if t == "List" then
    local out = {}
    for i, x in ipairs(v) do out[i] = plain(x) end
    return out
  end
  if type(v) == "table" then
    local out = {}
    for k, x in pairs(v) do out[k] = plain(x) end
    return out
  end
  return pandoc.utils.stringify(v)
end

local function str(v)
  if v == nil then return nil end
  local s = pandoc.utils.stringify(v)
  if s == "" then return nil end
  return s
end

local function strings(v)
  if v == nil then return nil end
  if pandoc.utils.type(v) == "List" then
    local out = {}
    for _, x in ipairs(v) do
      local s = str(x)
      if s then table.insert(out, s) end
    end
    return #out > 0 and out or nil
  end
  local s = str(v)
  return s and { s } or nil
end

-- website title and site-url are not passed to filters, so read them from _quarto.yml
local function read_site()
  local dir = quarto.project and quarto.project.directory
  if not dir then return {} end
  local f = io.open(pandoc.path.join({ dir, "_quarto.yml" }), "r")
  if not f then return {} end
  local text = "\n" .. f:read("*a")
  f:close()
  local url = text:match("\n%s*site%-url:%s*[\"']?([^%s\"'#]+)")
  if url and not url:match("/$") then url = url .. "/" end
  local website = text:match("\nwebsite:(.-)\n%S") or text:match("\nwebsite:(.*)$") or ""
  local title = website:match("\n%s+title:%s*\"([^\"]+)\"") or website:match("\n%s+title:%s*([^\n#]+)")
  if title then title = title:gsub("%s+$", "") end
  return { url = url, title = title }
end

local function page_url(base)
  if not base or not quarto.doc.input_file then return nil end
  local rel = pandoc.path.make_relative(quarto.doc.input_file, quarto.project.directory)
  rel = rel:gsub("\\", "/"):gsub("%.qmd$", ".html"):gsub("%.ipynb$", ".html"):gsub("%.md$", ".html")
  return base .. rel, rel
end

local function persons(author)
  if author == nil then return nil end
  local list = pandoc.utils.type(author) == "List" and author or { author }
  local out = {}
  for _, a in ipairs(list) do
    local name, url
    if type(a) == "table" and a.name ~= nil then
      name = str(a.name.literal or a.name)
      url = str(a.url)
    else
      name = str(a)
    end
    if name then
      local p = { ["@type"] = "Person", name = name }
      if url then p.url = url end
      table.insert(out, p)
    end
  end
  return #out > 0 and out or nil
end

local function iso_date(v)
  local s = str(v)
  if s and s:match("^%d%d%d%d%-%d%d%-%d%d") then return s end
  return nil
end

local function json_ld(meta)
  local site = read_site()
  if not site.url then return nil end
  local url, rel = page_url(site.url)
  local lang = str(meta.lang) or "en"
  local website = { ["@type"] = "WebSite", name = site.title or str(meta.title), url = site.url }

  if rel == "index.html" then
    website["@context"] = "https://schema.org"
    website.description = str(meta.description) or str(meta.subtitle)
    website.inLanguage = lang
    return website
  end

  if meta["article-type"] == nil then return nil end
  local ld = {
    ["@context"] = "https://schema.org",
    ["@type"] = "Article",
    headline = str(meta.title),
    description = str(meta.description),
    inLanguage = lang,
    url = url,
    mainEntityOfPage = url,
    isPartOf = website,
    articleSection = strings(meta.categories),
    keywords = strings(meta.keywords),
    author = persons(meta.author),
    datePublished = iso_date(meta.date),
    dateModified = iso_date(meta["date-modified"]) or iso_date(meta.date),
  }
  if site.url and meta.image then
    ld.image = site.url .. str(meta.image):gsub("^/", "")
  end
  return ld
end

function Meta(meta)
  if not quarto.doc.is_format("html") then return nil end

  quarto.doc.include_text("in-header", FONTS)

  quarto.doc.add_html_dependency({
    name = "mre",
    version = "0.1.0",
    scripts = { "mre.js" },
  })

  local cfg = plain(meta.mre) or {}
  if next(cfg) == nil then
    quarto.doc.include_text("in-header", "<script>window.MRE_CONFIG = {};</script>")
  else
    quarto.doc.include_text("in-header",
      "<script>window.MRE_CONFIG = " .. quarto.json.encode(cfg) .. ";</script>")
  end

  local ld = json_ld(meta)
  if ld then
    local text = quarto.json.encode(ld):gsub("</", "<\\/")
    quarto.doc.include_text("in-header", '<script type="application/ld+json">' .. text .. "</script>")
  end
  return nil
end
