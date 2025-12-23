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

    let html = `<div class="mt-4 space-y-3">`;

    attachments.forEach(att => {
        const isVideo = att.type === 'video' || att.url.match(/\.(mp4|webm|ogg)$/i);
        const name = att.name || "Attachment";

        if (isVideo) {
            html += `
            <div class="rounded-xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm group/video relative">
                <video src="${att.url}" class="w-full aspect-video block bg-black" controls playsinline controlsList="nodownload"></video>
                <div class="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md font-bold border border-white/10 opacity-0 group-hover/video:opacity-100 transition-opacity uppercase tracking-wider">${name}</div>
            </div>`;
        } else {
            const isImage = att.url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
            if (isImage) {
                html += `
                <div class="rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 group/img relative cursor-pointer" onclick="window.openFileViewer('${att.url}', 'image')">
                    <img src="${att.url}" class="w-full max-h-96 object-cover hover:scale-105 transition-transform duration-500" loading="lazy">
                    <div class="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                        <i class="fas fa-search-plus text-white text-2xl drop-shadow-lg"></i>
                    </div>
                </div>`;
            } else {
                html += `
                <button onclick="window.openFileViewer('${att.url}', 'file')" class="w-full flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl hover:border-brand-primary/40 hover:bg-white dark:hover:bg-slate-800 transition group/file">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-brand-primary">
                            <i class="fas ${att.url.includes('.pdf') ? 'fa-file-pdf text-red-500' : 'fa-file-alt'} text-lg"></i>
                        </div>
                        <div class="text-left">
                            <p class="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">${name}</p>
                            <p class="text-[10px] text-slate-400 font-bold uppercase">Click to preview</p>
                        </div>
                    </div>
                    <i class="fas fa-chevron-right text-slate-300 group-hover/file:translate-x-1 transition-transform"></i>
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
        const attachments = item.attachments || [];
        let videoUrl = item.url || "";
        let isUploaded = false;

        if (attachments.length > 0) {
            const hero = attachments.find(a => a.type === 'video') || attachments[0];
            videoUrl = hero.url;
            isUploaded = true;
        }

        const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
        const isDrive = videoUrl.includes('drive.google.com');

        // Professional Video Card with Play Launcher
        contentDisplay = `
        <div class="aspect-video bg-slate-900 relative group/video cursor-pointer overflow-hidden" onclick="window.openFileViewer('${videoUrl}', 'video')">
            <!-- Stylized Thumbnail Placeholder / Background -->
            <div class="absolute inset-0 bg-gradient-to-br from-slate-800 to-brand-dark opacity-50"></div>
            <div class="absolute inset-0 flex items-center justify-center">
                <div class="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white text-2xl group-hover/video:scale-110 group-hover/video:bg-brand-primary group-hover/video:border-brand-primary transition-all duration-300 shadow-2xl">
                    <i class="fas fa-play ml-1"></i>
                </div>
            </div>
            
            <!-- Metadata Badges -->
            <div class="absolute top-3 left-3 flex gap-2">
                <span class="bg-black/60 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded-md border border-white/10 uppercase tracking-widest leading-none flex items-center gap-1">
                    <i class="fas ${isYouTube ? 'fa-youtube text-red-500' : 'fa-play-circle text-brand-primary'} text-[10px]"></i>
                    ${isYouTube ? 'YouTube' : isDrive ? 'Google Drive' : 'Uploaded'}
                </span>
            </div>

            ${attachments.length > 1 ? `
            <div class="absolute top-3 right-3 bg-brand-primary text-white text-[10px] font-black px-2 py-1 rounded-md shadow-lg border border-white/20 uppercase tracking-widest leading-none">
                +${attachments.length - 1} Files
            </div>` : ''}

            <!-- Bottom Title Overlay (Subtle) -->
            <div class="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover/video:opacity-100 transition-opacity">
                <p class="text-white text-[11px] font-bold uppercase tracking-wider line-clamp-1">${item.title}</p>
            </div>
        </div>`;

        return `
        <div data-id="${item.id}" class="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative">
            ${dragHandle}
            ${contentDisplay}
            <div class="p-5">
                <div class="flex justify-between items-start gap-3">
                    <h4 class="font-bold text-slate-800 dark:text-slate-100 line-clamp-2 text-sm leading-tight flex-1">${item.title}</h4>
                    ${isAdmin ? `
                    <div class="flex gap-2 shrink-0">
                        <button onclick="window.openEditContentModal('${encodeURIComponent(JSON.stringify(item))}')" class="text-slate-300 hover:text-brand-primary transition-colors"><i class="fas fa-pencil-alt text-xs"></i></button>
                        <button onclick="window.deleteContent('${item.id}', 'videos')" class="text-slate-300 hover:text-red-500 transition-colors"><i class="fas fa-trash text-xs"></i></button>
                    </div>` : ''}
                </div>
                
                ${attachments.length > 1 ? `
                <div class="mt-4 pt-4 border-t border-slate-50 dark:border-slate-700/50">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Additional Files</p>
                    <div class="flex flex-wrap gap-2">
                        ${attachments.slice(1).map(att => `
                            <button onclick="window.openFileViewer('${att.url}', 'file')" class="text-[10px] font-bold bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-600 hover:border-brand-primary transition-colors truncate max-w-[120px]">
                                <i class="fas ${att.type === 'video' ? 'fa-play-circle text-brand-primary' : 'fa-file'} mr-1"></i> ${att.name}
                            </button>
                        `).join('')}
                    </div>
                </div>` : ''}

                <div class="mt-4 flex items-center justify-between">
                    <span class="text-[10px] text-slate-400 font-bold uppercase opacity-60">${new Date(item.createdAt).toLocaleDateString()}</span>
                    <i class="fas fa-circle text-[4px] text-slate-200"></i>
                    <span class="text-[10px] text-slate-400 font-bold uppercase opacity-60">${item.subcourseCode || 'Global'}</span>
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
