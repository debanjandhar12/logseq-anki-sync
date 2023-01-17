export async function SelectPrompt(msg: string, options: string[]): Promise<string | false> {
    return new Promise(function (resolve, reject) {
        const div = window.parent.document.createElement('div');
        div.innerHTML = `
        <div label="" class="ui__modal" style="z-index: 999;">
          <div class="ui__modal-overlay ease-out duration-300 opacity-100 enter-done">
            <div class="absolute inset-0 opacity-75"></div>
          </div>
          <div class="ui__modal-panel transform transition-all sm:min-w-lg sm ease-out duration-300 opacity-100 translate-y-0 sm:scale-100 enter-done">
            <div class="absolute top-0 right-0 pt-2 pr-2">
              <a aria-label="Close" type="button" class="ui__modal-close opacity-60 hover:opacity-100" onclick="select_cancel_action()">
                <svg stroke="currentColor" viewBox="0 0 24 24" fill="none" class="h-6 w-6">
                  <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
                </svg>
              </a>
            </div>
            <div class="panel-content">
              <div tabindex="-1" class="cp__themes-installed">
                <h1 class="mb-4 text-2xl p-1">${msg}</h1>
                <select id="select-prompt-selector" onchange="handle_select_action()" class="mt-1 block text-base leading-6 border-gray-300 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 form-select" style="padding: 0px 0px 0px 6px;">
                <option value="none" selected disabled hidden>Select an option</option>
                ${options.map((option) => `<option value="${option}">${option}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>
        </div>`;
        const onKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                window.parent.select_cancel_action();
            }
        };
        window.parent.document.addEventListener('keydown', onKeydown);
        // @ts-ignore
        window.parent.handle_select_action = () => {
            const select = div.querySelector('#select-prompt-selector');
            console.log(select);
            if (select) {
                resolve(select.value);
            }
            window.parent.document.body.removeChild(div);
        }
        // @ts-ignore
        window.parent.select_cancel_action = () => {
            resolve(false);
            window.parent.document.body.removeChild(div);
        }
        window.parent.document.body.appendChild(div);
        (div.querySelector('#select-prompt-selector') as HTMLSelectElement).focus();
    });
}