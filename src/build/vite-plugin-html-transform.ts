import type { Plugin } from 'vite';

export interface HtmlTransformOptions {
  isWeb: boolean;
}

export function htmlTransformPlugin(options: HtmlTransformOptions): Plugin {
  const { isWeb } = options;

  return {
    name: 'html-transform',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (isWeb) {
          html = html.replace(/<!--\s*@electron-only\s*-->[\s\S]*?<!--\s*@end-electron-only\s*-->/g, '');
          html = html.replace(/<!--\s*@web-only\s*-->/g, '');
          html = html.replace(/<!--\s*@end-web-only\s*-->/g, '');
        } else {
          html = html.replace(/<!--\s*@web-only\s*-->[\s\S]*?<!--\s*@end-web-only\s*-->/g, '');
          html = html.replace(/<!--\s*@electron-only\s*-->/g, '');
          html = html.replace(/<!--\s*@end-electron-only\s*-->/g, '');
        }
        return html;
      },
    },
  };
}
