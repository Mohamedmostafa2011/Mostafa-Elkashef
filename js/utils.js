export function showToast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `${type === 'error' ? 'bg-red-500' : 'bg-green-600'} text-white px-6 py-3.5 rounded-xl shadow-2xl font-bold fade-in z-[100]`;
    el.innerHTML = msg;
    const container = document.getElementById('toast-container');
    if (container) container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

export function setupSubcourseInputs(codes) {
    const container = document.getElementById('subcourse-container');
    container.innerHTML = '';

    const createInput = (val) => {
        const div = document.createElement('div');
        div.className = "flex items-center gap-2 mb-2 fade-in";
        div.innerHTML = `<input type="text" value="${val}" class="subcourse-input flex-1 p-3 bg-white border border-blue-200 rounded-lg text-sm font-mono outline-none focus:border-brand-primary uppercase" placeholder="Code (e.g. 10A)"> ${val ? `<button class="text-red-400 hover:text-red-600 px-2"><i class="fas fa-trash"></i></button>` : ''}`;

        const btn = div.querySelector('button');
        if (btn) btn.onclick = () => div.remove();

        const input = div.querySelector('input');
        input.addEventListener('input', (e) => {
            const all = container.querySelectorAll('input');
            if (e.target === all[all.length - 1] && e.target.value.trim() !== "") {
                container.appendChild(createInput(''));
            }
        });
        return div;
    };

    codes.forEach(c => container.appendChild(createInput(c)));
}

export function generateVideoCardHtml(item, isAdmin) {
    const dragHandle = isAdmin ? `<div class="drag-handle absolute top-2 left-2 z-20 cursor-grab text-white/80 hover:text-white drop-shadow-md bg-black/20 p-1.5 rounded-lg touch-action-none"><i class="fas fa-grip-vertical text-sm"></i></div>` : '';

    if (item.type === 'folder') {
        const folderHandle = isAdmin ? `<div class="drag-handle absolute top-2 left-2 z-20 cursor-grab text-yellow-300 hover:text-yellow-600 p-1.5 touch-action-none"><i class="fas fa-grip-vertical"></i></div>` : '';
        // Using window functions in onclick strings (bridge required in main.js)
        return `
        <div data-id="${item.id}" onclick="window.navigateToFolder('${item.id}', null, '${item.title}')" class="bg-yellow-50 dark:bg-yellow-950/30 rounded-xl p-6 border border-yellow-100 dark:border-yellow-900 cursor-pointer hover:shadow-lg hover:border-yellow-300 dark:hover:border-yellow-600 transition flex flex-col items-center justify-center text-center group relative select-none h-full">
            ${folderHandle}
            <div class="text-4xl text-yellow-400 mb-2 group-hover:scale-110 transition"><i class="fas fa-folder"></i></div>
            <h4 class="font-bold text-yellow-950 dark:text-yellow-50 line-clamp-1">${item.title}</h4>
            <span class="text-[10px] text-yellow-600 dark:text-yellow-500 font-bold uppercase tracking-wider">Folder</span>
            ${isAdmin ? `
            <div class="absolute top-2 right-2 flex gap-1 z-20" onclick="event.stopPropagation()">
                <button onclick="window.openEditContentModal('${encodeURIComponent(JSON.stringify(item))}')" class="w-6 h-6 rounded-full bg-white dark:bg-slate-800 text-slate-400 hover:text-brand-primary flex items-center justify-center shadow-sm"><i class="fas fa-pencil-alt text-xs"></i></button>
                <button onclick="window.deleteContent('${item.id}', 'videos')" class="w-6 h-6 rounded-full bg-white dark:bg-slate-800 text-red-300 hover:text-red-500 flex items-center justify-center shadow-sm"><i class="fas fa-trash text-xs"></i></button>
            </div>` : ''}
        </div>`;
    } else {
        let embedUrl = item.url || "";
        let isDirectFile = false;
        if (embedUrl.includes('drive.google.com')) {
            embedUrl = embedUrl.split('?')[0];
            embedUrl = embedUrl.replace(/\/view$/, '/preview').replace(/\/edit$/, '/preview');
        } else if (embedUrl.includes('watch?v=')) {
            embedUrl = embedUrl.replace('watch?v=', 'embed/');
        } else if (embedUrl.includes('youtu.be/')) {
            embedUrl = embedUrl.replace('youtu.be/', 'www.youtube.com/embed/');
        } else {
            // Assume direct file (Hugging Face or other direct link)
            isDirectFile = true;
        }

        return `
        <div data-id="${item.id}" class="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg transition group relative">
            ${dragHandle}
            <div class="aspect-video bg-slate-900 flex items-center justify-center">
                ${isDirectFile
                ? `<video src="${embedUrl}" class="w-full h-full block" controls playsinline controlsList="nodownload"></video>`
                : `<iframe src="${embedUrl}" class="w-full h-full" frameborder="0" allowfullscreen></iframe>`
            }
            </div>
            <div class="p-4">
                <div class="flex justify-between items-start gap-2">
                    <h4 class="font-bold text-slate-800 dark:text-slate-100 line-clamp-2 text-sm flex-1">${item.title}</h4>
                    ${isAdmin ? `
                    <div class="flex gap-2 shrink-0">
                        <button onclick="window.openEditContentModal('${encodeURIComponent(JSON.stringify(item))}')" class="text-slate-400 hover:text-brand-primary"><i class="fas fa-pencil-alt"></i></button>
                        <button onclick="window.deleteContent('${item.id}', 'videos')" class="text-red-400 hover:text-red-600"><i class="fas fa-trash"></i></button>
                    </div>` : ''}
                </div>
                <p class="text-[10px] text-slate-400 mt-2 font-bold flex justify-between">
                    <span>${new Date(item.createdAt).toLocaleDateString()}</span>
                </p>
            </div>
        </div>`;
    }
}

export function getSkeletonHtml(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
        <div class="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 animate-pulse">
            <div class="h-40 bg-slate-200 dark:bg-slate-700"></div>
            <div class="p-4 space-y-3">
                <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                <div class="flex justify-between pt-2">
                    <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded w-12"></div>
                </div>
            </div>
        </div>`;
    }
    return `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 fade-in">${html}</div>`;
}

export function withViewTransition(fn) {
    if (!document.startViewTransition) {
        fn();
    } else {
        document.startViewTransition(() => fn());
    }
}
