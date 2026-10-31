import { prepareEmailHtmlForDisplay } from "@rodge-mail/features/mail";

export type OriginalHtmlMessage =
  | { type: "height"; height: number }
  | { type: "link"; url: string };

const OPENABLE_LINK = /^(?:https?|mailto|tel):/iu;
const HEIGHT_PREFIX = "height:";
const LINK_PREFIX = "link:";

export function createOriginalHtmlDocument({
  background,
  foreground,
  html,
  inlineImageUrls,
}: {
  background: string;
  foreground: string;
  html: string;
  inlineImageUrls?: Readonly<Record<string, string>>;
}) {
  const displayHtml = prepareEmailHtmlForDisplay(html, inlineImageUrls);
  return `<!doctype html><html><head><meta id="viewport" name="viewport" content="width=device-width,initial-scale=1"><style>html,body{box-sizing:border-box;margin:0;padding:0;background:${background};color:${foreground};font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:16px;line-height:1.55;-webkit-text-size-adjust:100%}#message{min-width:0}img,video,svg,canvas{max-width:100%;height:auto}iframe,object,embed{max-width:100%}a{color:${foreground};overflow-wrap:anywhere}pre,code{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><div id="message">${displayHtml}</div><script>${DOCUMENT_SCRIPT}</script></body></html>`;
}

// The sanitizer gives every link target="_blank", which WKWebView hands to a
// new-window delegate @expo/dom-webview doesn't implement, so taps did
// nothing. Links go to the app instead, which opens them.
const DOCUMENT_SCRIPT = [
  'const viewport=document.getElementById("viewport");',
  'const message=document.getElementById("message");',
  "const post=(message)=>window.ReactNativeWebView.postMessage(message);",
  "const deviceWidth=document.documentElement.clientWidth;",
  "let viewportWidth=deviceWidth;",
  'const sendHeight=()=>{const scale=Math.min(1,deviceWidth/viewportWidth);post("height:"+(document.documentElement.scrollHeight*scale+8))};',
  'const fit=()=>{const requiredWidth=Math.ceil(Math.max(message.scrollWidth,document.body.scrollWidth));if(requiredWidth>viewportWidth+1){viewportWidth=requiredWidth;viewport.setAttribute("content","width="+viewportWidth);requestAnimationFrame(fit);return}sendHeight()};',
  'document.addEventListener("click",(event)=>{const link=event.target instanceof Element?event.target.closest("a[href]"):null;if(!link)return;event.preventDefault();try{post("link:"+new URL(link.getAttribute("href").trim()).href)}catch{}},true);',
  "new ResizeObserver(fit).observe(message);",
  'for(const image of document.images){image.addEventListener("load",fit);image.addEventListener("error",fit)}',
  'window.addEventListener("load",fit);fit()',
].join("");

export function parseOriginalHtmlMessage(data: string) {
  if (data.startsWith(HEIGHT_PREFIX)) {
    const height = Number(data.slice(HEIGHT_PREFIX.length));
    if (!Number.isFinite(height)) return undefined;
    return { type: "height", height } satisfies OriginalHtmlMessage;
  }
  if (data.startsWith(LINK_PREFIX)) {
    const url = data.slice(LINK_PREFIX.length);
    if (!OPENABLE_LINK.test(url)) return undefined;
    return { type: "link", url } satisfies OriginalHtmlMessage;
  }
  return undefined;
}
