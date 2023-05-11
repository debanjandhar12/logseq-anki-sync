export async function Confirm(msg: string): Promise<boolean> {
   return new Promise(function (resolve, reject) {
      const root = window.parent.document.getElementById('root')
      const div = window.parent.document.createElement('div')
      div.innerHTML = `
            <div class="ui__modal anki_sync_confirm" style="z-index: 9999;">
            <div class="ui__modal-overlay ease-out duration-300 opacity-100 enter-done">
               <div class="absolute inset-0 opacity-75"></div>
            </div>
            <div class="ui__modal-panel transform transition-all sm:min-w-lg sm ease-out duration-300 opacity-100 translate-y-0 sm:scale-100 enter-done">
               <div class="absolute top-0 right-0 pt-2 pr-2">
                  <a aria-label="Close" type="button" class="ui__modal-close opacity-60 hover:opacity-100" onclick="sync_cancel_action()">
                     <svg stroke="currentColor" viewBox="0 0 24 24" fill="none" class="h-6 w-6">
                        <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
                     </svg>
                  </a>
               </div>
               <div class="panel-content">
                  <div class="ui__confirm-modal is-">
                     <div class="sm:flex sm:items-start">
                        <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                           <h2 class="headline text-lg leading-6 font-medium">${msg}</h2>
                           <label class="sublabel">
                              <h3 class="subline text-gray-400"></h3>
                           </label>
                        </div>
                     </div>
                     <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse"><span class="flex w-full rounded-md shadow-sm sm:ml-3 sm:w-auto"><button type="button" class="inline-flex justify-center w-full rounded-md border border-transparent px-4 py-2 bg-indigo-600 text-base leading-6 font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 focus:shadow-outline-indigo transition ease-in-out duration-150 sm:text-sm sm:leading-5" onclick="sync_yes_action()">Yes</button></span><span class="mt-3 flex w-full rounded-md shadow-sm sm:mt-0 sm:w-auto"><button type="button" class="inline-flex justify-center w-full rounded-md border border-gray-300 px-4 py-2 bg-white text-base leading-6 font-medium text-gray-700 shadow-sm hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue transition ease-in-out duration-150 sm:text-sm sm:leading-5" onclick="sync_cancel_action()">Cancel</button></span></div>
                  </div>
               </div>
            </div>
         </div>`;
      root?.appendChild(div)
      const onKeydown = (e: KeyboardEvent) => {
         if (e.key === 'Escape') {
            // @ts-ignore
            window.parent.sync_cancel_action();
         }
         else if (e.key === 'Enter') {
            // @ts-ignore
            window.parent.sync_yes_action();
         }
      }
      window.parent.document.addEventListener('keydown', onKeydown);
      // @ts-ignore
      window.parent.sync_yes_action = () => {
         resolve(true);
         root.removeChild(div);
         window.parent.document.removeEventListener('keydown', onKeydown);
      }
      // @ts-ignore
      window.parent.sync_cancel_action = () => {
         resolve(false);
         root.removeChild(div);
         window.parent.document.removeEventListener('keydown', onKeydown);
      }

   });
}