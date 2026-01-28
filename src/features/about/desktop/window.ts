declare const aboutDialog: {
  onInit: (callback: (data: { version: string; platform: string }) => void) => void;
  close: () => void;
};

const versionEl = document.getElementById('about-version') as HTMLElement;

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' || e.key === 'Enter') {
    window.close();
  }
});

aboutDialog.onInit(data => {
  versionEl.textContent = `Version ${data.version} [${data.platform}]`;
});
