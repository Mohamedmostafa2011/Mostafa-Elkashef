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

export function generateAttachmentsHtml(attachments, title = "") {
    if (!attachments || attachments.length === 0) return '';

    let html = `<div class="mt-4 space-y-4">`;

    attachments.forEach(att => {
        const isVideo = att.type === 'video' || att.url.match(/\.(mp4|webm|ogg)$/i);
        const name = att.name || "Attachment";

        if (isVideo) {
            // Append #t=0.001 to show first frame as thumbnail
            const videoUrl = att.url.includes('#t=') ? att.url : att.url + "#t=0.001";
            html += `
            <div class="rounded-2xl overflow-hidden bg-white border border-slate-100 dark:border-slate-700 shadow-sm group/video relative cursor-pointer" onclick="window.openFileViewer('${att.url}', 'video')">
                <div class="aspect-video relative bg-slate-100 dark:bg-black overflow-hidden">
                    <video src="${videoUrl}" class="w-full h-full object-cover pointer-events-none" playsinline muted></video>
                    <div class="absolute inset-0 bg-black/20 group-hover/video:bg-black/40 transition-colors flex items-center justify-center">
                        <div class="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white text-2xl group-hover/video:scale-110 transition-transform shadow-xl">
                            <i class="fas fa-play ml-1"></i>
                        </div>
                    </div>
                </div>
                <div class="p-4 bg-white dark:bg-slate-800 border-t border-slate-50 dark:border-slate-700">
                    <h5 class="font-bold text-slate-800 dark:text-slate-100 text-sm line-clamp-1">${name}</h5>
                    <p class="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Video Lesson</p>
                </div>
            </div>`;
        } else {
            const isImage = att.url.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp)$/i);
            if (isImage) {
                html += `
                <div class="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 group/img relative cursor-pointer shadow-sm" onclick="window.openFileViewer('${att.url}', 'image')">
                    <img src="${att.url}" class="w-full max-h-96 object-cover hover:scale-105 transition-transform duration-700" loading="lazy">
                    <div class="absolute inset-0 bg-black/10 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                        <div class="w-12 h-12 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white text-xl">
                            <i class="fas fa-search-plus"></i>
                        </div>
                    </div>
                    <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                        <p class="text-[10px] text-white font-bold uppercase tracking-widest">${name}</p>
                    </div>
                </div>`;
            } else {
                html += `
                <button onclick="window.openFileViewer('${att.url}', 'file')" class="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-brand-primary/40 hover:shadow-md transition group/file">
                    <div class="flex items-center gap-4">
                        <div class="w-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-700 shadow-sm flex items-center justify-center text-brand-primary">
                            <i class="fas ${att.url.includes('.pdf') ? 'fa-file-pdf text-red-500' : 'fa-file-alt'} text-xl"></i>
                        </div>
                        <div class="text-left">
                            <p class="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">${name}</p>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tap to preview</p>
                        </div>
                    </div>
                    <div class="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-700 text-slate-300 group-hover/file:text-brand-primary group-hover/file:bg-brand-light transition">
                        <i class="fas fa-chevron-right text-xs"></i>
                    </div>
                </button>`;
            }
        }
    });

    html += `</div>`;
    return html;
}

export function generateVideoCardHtml(item, isAdmin) {
    const dragHandle = isAdmin ? `<div class="drag-handle absolute top-2 left-2 z-20 cursor-grab text-white/80 hover:text-white drop-shadow-md bg-black/20 p-1.5 rounded-lg touch-action-none"><i class="fas fa-grip-vertical text-sm"></i></div>` : '';

    if (item.type === 'folder') {
        const folderHandle = isAdmin ? `<div class="drag-handle absolute top-2 left-2 z-20 cursor-grab text-yellow-300 hover:text-yellow-600 p-1.5 touch-action-none"><i class="fas fa-grip-vertical"></i></div>` : '';
        return `
        <div data-id="${item.id}" onclick="window.navigateToFolder('${item.id}', null, '${item.title}')" class="bg-white dark:bg-slate-800/50 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-xl hover:border-brand-primary/20 transition-all duration-500 flex flex-col items-center justify-center text-center group relative select-none h-full shadow-sm">
            ${folderHandle}
            <div class="w-20 h-20 rounded-[2rem] bg-yellow-50 dark:bg-yellow-950/30 text-yellow-500 flex items-center justify-center text-4xl mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-sm">
                <i class="fas fa-folder-open"></i>
            </div>
            <h4 class="font-bold text-slate-900 dark:text-slate-50 text-lg mb-1 line-clamp-1">${item.title}</h4>
            <span class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Folder Library</span>
            ${isAdmin ? `
            <div class="absolute top-4 right-4 flex gap-2 z-20" onclick="event.stopPropagation()">
                <button onclick="window.openEditContentModal('${encodeURIComponent(JSON.stringify(item))}')" class="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-brand-primary flex items-center justify-center transition-colors"><i class="fas fa-pencil-alt text-xs"></i></button>
                <button onclick="window.deleteContent('${item.id}', 'videos')" class="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"><i class="fas fa-trash text-xs"></i></button>
            </div>` : ''}
        </div>`;
    } else {
        const attachments = item.attachments || [];
        let contentDisplay = '';

        if (attachments.length > 0) {
            const hero = attachments[0];
            if (hero.type === 'video') {
                const videoPreviewUrl = hero.url.includes('#t=') ? hero.url : hero.url + "#t=0.001";
                contentDisplay = `
                <div class="aspect-video relative bg-slate-100 dark:bg-black overflow-hidden group/thumb" onclick="window.openFileViewer('${hero.url}', 'video')">
                    <video src="${videoPreviewUrl}" class="w-full h-full object-cover pointer-events-none" playsinline muted></video>
                    <div class="absolute inset-0 bg-black/20 group-hover/thumb:bg-black/40 transition-all flex items-center justify-center">
                        <div class="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white text-2xl group-hover/thumb:scale-110 transition-all duration-500 shadow-2xl">
                            <i class="fas fa-play ml-1"></i>
                        </div>
                    </div>
                </div>`;
            } else {
                contentDisplay = `
                <div class="aspect-video bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300">
                    <i class="fas fa-file-alt text-5xl"></i>
                </div>`;
            }
        } else {
            let embedUrl = item.url || "";
            const isVideoFile = embedUrl.match(/\.(mp4|webm|ogg)$/i);

            if (embedUrl.includes('drive.google.com')) {
                embedUrl = embedUrl.split('?')[0].replace(/\/view$/, '/preview').replace(/\/edit$/, '/preview');
            } else if (embedUrl.includes('watch?v=')) {
                embedUrl = embedUrl.replace('watch?v=', 'embed/');
            } else if (embedUrl.includes('youtu.be/')) {
                embedUrl = embedUrl.replace('youtu.be/', 'www.youtube.com/embed/');
            }

            contentDisplay = `
            <div class="aspect-video relative bg-black flex items-center justify-center overflow-hidden group/embed" onclick="window.openFileViewer('${item.url}', 'video')">
                <div class="absolute inset-0 bg-slate-900 flex items-center justify-center text-slate-700">
                    <i class="fas fa-play-circle text-6xl opacity-30"></i>
                </div>
                ${isVideoFile
                    ? `<video src="${embedUrl}#t=0.001" class="w-full h-full object-cover opacity-80" playsinline muted></video>`
                    : `<div class="w-full h-full bg-slate-800 flex flex-col items-center justify-center gap-2">
                        <i class="fab fa-youtube text-red-500 text-4xl"></i>
                        <span class="text-[10px] text-white/50 font-bold uppercase tracking-widest">Video Hub</span>
                      </div>`
                }
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none group-hover/embed:scale-110 transition-transform">
                     <div class="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white text-2xl shadow-2xl">
                        <i class="fas fa-play ml-1"></i>
                     </div>
                </div>
            </div>`;
        }

        return `
        <div data-id="${item.id}" class="bg-white dark:bg-slate-800 rounded-[1.5rem] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-all duration-500 group">
            ${dragHandle}
            ${contentDisplay}
            <div class="p-6">
                <div class="flex justify-between items-start gap-4 mb-4">
                    <h4 class="font-bold text-slate-900 dark:text-slate-100 line-clamp-2 text-[15px] leading-tight flex-1 font-display hover:text-brand-primary transition-colors cursor-pointer" onclick="window.openFileViewer('${item.url || (attachments[0] ? attachments[0].url : '')}', 'video')">${item.title}</h4>
                    ${isAdmin ? `
                    <div class="flex gap-1 shrink-0">
                        <button onclick="window.openEditContentModal('${encodeURIComponent(JSON.stringify(item))}')" class="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-brand-primary hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all"><i class="fas fa-pencil-alt text-xs"></i></button>
                        <button onclick="window.deleteContent('${item.id}', 'videos')" class="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"><i class="fas fa-trash text-xs"></i></button>
                    </div>` : ''}
                </div>
                
                <div class="flex items-center justify-between text-slate-400">
                    <div class="flex items-center gap-2">
                         <span class="text-[11px] font-bold uppercase tracking-wider opacity-60">${new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
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
