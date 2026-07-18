export function createOriginalHtmlDocument({
  background,
  foreground,
  html,
}: {
  background: string;
  foreground: string;
  html: string;
}) {
  return `<!doctype html><html><head><meta id="viewport" name="viewport" content="width=device-width,initial-scale=1"><style>html,body{box-sizing:border-box;margin:0;padding:0;background:${background};color:${foreground};font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:16px;line-height:1.55;-webkit-text-size-adjust:100%}#message{min-width:0}img,video,svg,canvas{max-width:100%;height:auto}iframe,object,embed{max-width:100%}a{color:#9a6b16;overflow-wrap:anywhere}pre,code{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><div id="message">${html}</div><script>const viewport=document.getElementById("viewport");const message=document.getElementById("message");const deviceWidth=document.documentElement.clientWidth;let viewportWidth=deviceWidth;const sendHeight=()=>{const scale=Math.min(1,deviceWidth/viewportWidth);window.ReactNativeWebView.postMessage(String(document.documentElement.scrollHeight*scale+8))};const fit=()=>{const requiredWidth=Math.ceil(Math.max(message.scrollWidth,document.body.scrollWidth));if(requiredWidth>viewportWidth+1){viewportWidth=requiredWidth;viewport.setAttribute("content","width="+viewportWidth);requestAnimationFrame(fit);return}sendHeight()};new ResizeObserver(fit).observe(message);window.addEventListener("load",fit);fit()</script></body></html>`;
}
