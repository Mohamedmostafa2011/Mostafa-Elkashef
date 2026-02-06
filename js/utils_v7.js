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

    const isFolder = item.type === 'folder' || item.type === 'file_folder';

    if (isFolder) {
        // NEW FOLDER DESIGN: Support Thumbnails (Topic Info) OR Default
        const folderHandle = isAdmin ? `<div class="drag-handle absolute top-3 left-3 z-30 cursor-grab text-white/50 hover:text-white p-2 touch-action-none transition-colors"><i class="fas fa-grip-vertical"></i></div>` : '';

        // Check for Thumbnail Data
        const topicNo = item.topicNo;
        const hasThumbnail = topicNo || (item.attachments && item.attachments.length > 0);

        let folderThumbnailHtml = '';

        if (hasThumbnail) {
            // USE "OLD THUMBNAIL" DESIGN (Text Based)
            // COLOR: YELLOW for Folder
            if (topicNo) {
                folderThumbnailHtml = `
                    <div class="absolute inset-0 bg-slate-900 overflow-hidden flex flex-col justify-center items-center text-center p-6">
                        <!-- Background Geometric Accent: Amber/Yellow -->
                        <div class="absolute -top-32 -right-32 w-80 h-80 bg-amber-600/20 rounded-full blur-3xl opacity-60"></div>
                        <div class="absolute -bottom-32 -left-32 w-80 h-80 bg-yellow-600/20 rounded-full blur-3xl opacity-60"></div>
                        
                        <!-- Grid Pattern Overlay -->
                        <div class="absolute inset-0 opacity-[0.05] pointer-events-none" style="background-image: linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px); background-size: 20px 20px;"></div>
        
                        <!-- 1. Topic/Folder Badge (Index) -->
                        <div class="relative">
                            <div class="bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-1.5 rounded-xl text-[11px] font-black text-white uppercase tracking-[0.2em] shadow-lg shadow-amber-500/20 border border-white/20 backdrop-blur-md flex items-center gap-2">
                                <i class="fas fa-folder-open"></i> ${topicNo}
                            </div>
                        </div>
                        
                        <!-- 3. Main Title (Centered vertically) -->
                        <div class="flex-1 flex items-center justify-center py-4">
                            <h3 class="text-white text-3xl md:text-5xl font-black leading-snug selection:bg-amber-500 tracking-tight drop-shadow-2xl px-2">
                                ${item.title}
                            </h3>
                        </div>
        
                        <!-- Branding Footer -->
                        <div class="mt-auto mb-2 flex flex-col items-center gap-2 opacity-60">
                            <div class="h-0.5 w-8 bg-white/30 rounded-full"></div>
                            <span class="text-[9px] text-white font-bold uppercase tracking-[0.3em]">Folder</span>
                        </div>
                    </div>`;
            } else if (item.attachments && item.attachments.length > 0 && (item.attachments[0].type === 'image' || item.attachments[0].url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i))) {
                // IMAGE COVER (Kept just in case, but creation for it is disabled now)
                folderThumbnailHtml = `
                    <img src="${item.attachments[0].url}" class="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">
                    <div class="absolute inset-0 bg-black/40"></div>
                    <div class="absolute inset-0 flex items-center justify-center">
                         <div class="bg-black/50 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center">
                            <i class="fas fa-folder text-4xl text-amber-500 mb-2"></i>
                            <h3 class="text-white font-bold text-lg drop-shadow-md">${item.title}</h3>
                         </div>
                    </div>
                 `;
            }
        } else {
            // DEFAULT FOLDER DESIGN (No Thumbnail)
            folderThumbnailHtml = `
            <!-- Animated Background Gradient -->
            <div class="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-slate-900 to-purple-600/20 group-hover:from-blue-600/30 group-hover:to-purple-600/30 transition-all duration-500"></div>
            
            <!-- Glassmorphism Effects -->
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.1),transparent_70%)]"></div>
            
            <!-- Folder Icon / Graphic -->
            <div class="absolute inset-0 flex flex-col items-center justify-center z-10 p-6">
                <div class="relative mb-6">
                    <div class="w-20 h-20 bg-gradient-to-br from-amber-300 to-orange-500 rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 z-10 relative">
                        <i class="fas fa-folder text-white text-3xl drop-shadow-md"></i>
                    </div>
                    <!-- Back Folder Plate -->
                    <div class="absolute top-[-8px] left-[-8px] w-20 h-20 bg-white/5 rounded-2xl border border-white/10 transform rotate-[-6deg] group-hover:rotate-[-12deg] transition-all duration-300"></div>
                </div>
                
                <h4 class="text-xl font-bold text-white text-center leading-tight line-clamp-2 drop-shadow-lg group-hover:text-amber-200 transition-colors">${item.title}</h4>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 border border-white/10 px-2 py-0.5 rounded-full bg-black/20 backdrop-blur-md group-hover:bg-amber-500/20 group-hover:text-amber-200 transition-all">${item.section ? item.section.toUpperCase() : 'FOLDER'}</p>
            </div>`;
        }

        return `
        <div data-id="${item.id}" onclick="window.navigateToFolder('${item.id}', null, '${item.title}')" class="group relative w-full aspect-[4/3] md:aspect-square bg-slate-900 rounded-[2rem] overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 border border-slate-800 selection:bg-transparent">
            
            ${folderHandle}
            
            ${folderThumbnailHtml}

            <!-- Admin Actions -->
            ${isAdmin ? `
            <div class="absolute top-3 right-3 flex gap-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-md rounded-xl p-1 border border-white/10" onclick="event.stopPropagation()">
                <button onclick="window.openEditContentModal('${encodeURIComponent(JSON.stringify(item))}')" class="w-8 h-8 rounded-lg text-slate-200 hover:text-white hover:bg-white/20 flex items-center justify-center transition"><i class="fas fa-pencil-alt text-xs"></i></button>
                <button onclick="window.deleteContent('${item.id}', '${item.section || 'content'}')" class="w-8 h-8 rounded-lg text-red-300 hover:text-red-400 hover:bg-white/20 flex items-center justify-center transition"><i class="fas fa-trash text-xs"></i></button>
            </div>` : ''}

            <!-- Decorative Bottom Bar -->
            <div class="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
        </div>`;
    } else {
        const attachments = item.attachments || [];
        let videoUrl = item.url || "";
        const isFile = item.type === 'file';

        if (attachments.length > 0 && !isFile) {
            const hero = attachments.find(a => a.type === 'video' || a.url.match(/\.(mp4|webm|ogg)$/i)) || attachments[0];
            videoUrl = hero.url;
        }

        const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
        const isDrive = videoUrl.includes('drive.google.com');
        const topicNo = item.topicNo;
        const topicTitle = item.topicTitle;

        // Extract YouTube/Video Thumbnail
        let thumbnailHtml = `<div class="absolute inset-0 bg-gradient-to-br from-slate-900 to-brand-dark opacity-40"></div>`;

        if (topicNo && topicTitle) {
            // THE "IMPRESSIVE" CSS THUMBNAIL DESIGN
            // ORDER: Badge (Index) -> Topic Title -> Main Title (Title/Name)
            // COLORS: Video=Blue, File=Green, Folder=Yellow (handled in isFolder block)

            if (isFile) {
                // DISTINCT DESIGN FOR FILES (Green/Emerald Theme)
                thumbnailHtml = `
            <div class="absolute inset-0 bg-slate-900 overflow-hidden flex flex-col justify-center items-center text-center p-6">
                <!-- Background Geometric Accent: Emerald/Green -->
                <div class="absolute -top-32 -right-32 w-80 h-80 bg-emerald-600/20 rounded-full blur-3xl opacity-60"></div>
                <div class="absolute -bottom-32 -left-32 w-80 h-80 bg-green-600/20 rounded-full blur-3xl opacity-60"></div>
                
                <!-- Grid Pattern Overlay -->
                <div class="absolute inset-0 opacity-[0.05] pointer-events-none" style="background-image: linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px); background-size: 20px 20px;"></div>

                <!-- 1. Topic Index (Badge) -->
                <div class="relative">
                    <div class="bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-1.5 rounded-xl text-[11px] font-black text-white uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 border border-white/20 backdrop-blur-md flex items-center gap-2">
                        <i class="fas fa-file-alt"></i> ${topicNo}
                    </div>
                </div>
                
                <!-- 2. Topic Title (Centered vertically) -->
                <div class="flex-1 flex items-center justify-center py-4">
                    <h4 class="text-white text-3xl md:text-5xl font-black uppercase tracking-widest drop-shadow-2xl">
                        ${topicTitle}
                    </h4>
                </div>

                <!-- Branding Footer -->
                <div class="mt-auto mb-2 flex flex-col items-center gap-2 opacity-60">
                    <div class="h-0.5 w-8 bg-white/30 rounded-full"></div>
                    <span class="text-[9px] text-white font-bold uppercase tracking-[0.3em]">File</span>
                </div>
            </div>`;
            } else {
                // VIDEO DESIGN (Blue/Purple Theme)
                thumbnailHtml = `
            <div class="absolute inset-0 bg-[#0f172a] overflow-hidden flex flex-col justify-center items-center text-center p-6">
                <!-- Background Geometric Accent -->
                <div class="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl"></div>
                <div class="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl"></div>
                
                <!-- Math Pattern Overlay -->
                <div class="absolute inset-0 opacity-[0.03] pointer-events-none" style="background-image: url('https://www.transparenttextures.com/patterns/cubes.png');"></div>

                <!-- 1. Topic Badge -->
                <div class="relative">
                    <div class="bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-1.5 rounded-full text-[10px] font-black text-white uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 border border-white/20 backdrop-blur-md">
                        ${topicNo}
                    </div>
                </div>

                <!-- 2. Topic Title (Centered vertically) -->
                <div class="flex-1 flex items-center justify-center py-4">
                    <h4 class="text-white text-3xl md:text-5xl font-black uppercase tracking-widest drop-shadow-2xl">
                        ${topicTitle}
                    </h4>
                </div>

                <!-- Branding Footer -->
                <div class="mt-auto flex flex-col items-center gap-2">
                    <div class="h-0.5 w-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                    <span class="text-[10px] text-white/40 font-bold uppercase tracking-[0.3em] font-display">Video</span>
                </div>
            </div>`;
            }
        } else if (isYouTube) {
            let videoId = "";
            if (videoUrl.includes('watch?v=')) videoId = videoUrl.split('v=')[1]?.split('&')[0];
            else if (videoUrl.includes('youtu.be/')) videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
            else if (videoUrl.includes('embed/')) videoId = videoUrl.split('embed/')[1]?.split('?')[0];

            if (videoId) {
                thumbnailHtml = `
                <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" class="absolute inset-0 w-full h-full object-cover">
                <div class="absolute inset-0 bg-black/10"></div>`;
            }
        } else if (isDrive) {
            // Google Drive
            thumbnailHtml = `
            <div class="absolute inset-0 bg-gradient-to-br from-brand-primary to-brand-dark flex items-center justify-center overflow-hidden">
                <div class="absolute inset-0 opacity-20 scale-150 rotate-12"><i class="fas fa-play-circle text-[200px] text-white"></i></div>
                <div class="relative z-10 flex flex-col items-center gap-2">
                    <div class="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-xl border border-white/30">
                        <i class="fab fa-google-drive"></i>
                    </div>
                </div>
            </div>
            <div class="absolute inset-0 bg-black/10"></div>`;
        } else if (videoUrl && !isFile) {
            thumbnailHtml = `
            <video src="${videoUrl}#t=0.1" class="absolute inset-0 w-full h-full object-cover" preload="metadata" muted playsinline></video>
            <div class="absolute inset-0 bg-black/10"></div>`;
        } else if (isFile) {
            // Generic File Thumbnail
            thumbnailHtml = `
            <div class="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center overflow-hidden">
                <div class="absolute inset-0 opacity-10 rotate-12"><i class="fas fa-file text-[200px] text-white"></i></div>
                <div class="relative z-10 flex flex-col items-center gap-2">
                    <div class="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white text-3xl border border-white/20 shadow-xl">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <p class="text-white text-xs font-bold uppercase tracking-widest mt-2 opacity-80">Document</p>
                </div>
            </div>`;
        }

        const safeUrl = videoUrl.replace(/'/g, "\\'");
        const isDynamic = !!(topicNo && topicTitle);

        let contentDisplay = `
        <div class="aspect-video bg-slate-900 relative group/video cursor-pointer overflow-hidden" onclick="window.openFileViewer('${safeUrl}', '${isFile ? 'file' : 'video'}')">
            <!-- Dynamic Thumbnail -->
            ${thumbnailHtml}

            <!-- Play/View Button Overlay -->
            <div class="absolute inset-0 flex items-center justify-center z-30">
                <div class="w-16 h-16 rounded-full ${isDynamic ? 'bg-white/0 border-white/0' : 'bg-white/10 backdrop-blur-md border-white/20'} flex items-center justify-center text-white text-2xl group-hover/video:scale-110 group-hover/video:bg-brand-primary/80 group-hover/video:border-brand-primary group-hover/video:backdrop-blur-md transition-all duration-300 shadow-2xl">
                    <i class="fas ${isFile ? 'fa-eye' : 'fa-play ml-1'} ${isDynamic ? 'opacity-0 group-hover/video:opacity-100' : ''}"></i>
                </div>
            </div>
            
            <!-- Metadata Badge -->
            ${!isDynamic && !isFile ? `
            <div class="absolute top-3 left-3 z-20">
                <span class="bg-black/40 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-md border border-white/10 uppercase tracking-widest leading-none flex items-center gap-1">
                    <i class="fas ${isYouTube ? 'fa-youtube text-red-500' : 'fa-play-circle text-brand-primary'} text-[10px]"></i>
                    ${isYouTube ? 'YouTube' : 'Video'}
                </span>
            </div>` : ''}

            ${attachments.length > 1 ? `
            <div class="absolute top-3 right-3 bg-brand-primary text-white text-[10px] font-black px-2 py-1 rounded-md shadow-lg border border-white/20 uppercase tracking-widest leading-none z-20">
                +${attachments.length - 1} Files
            </div>` : ''}

            <!-- Bottom Title Overlay (Visible on Hover) -->
            <div class="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover/video:opacity-100 transition-opacity z-20">
                <p class="text-white text-[11px] font-bold uppercase tracking-wider line-clamp-1">${item.title}</p>
            </div>
        </div>`;

        return `
        <div data-id="${item.id}" class="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative">
            ${dragHandle}
            ${contentDisplay}
            <div class="p-5">
                <div class="flex justify-between items-start gap-3">
                    <h4 class="font-bold text-slate-800 dark:text-slate-100 line-clamp-2 text-sm leading-tight flex-1">
                        ${item.title}
                    </h4>
                    ${isAdmin ? `
                    <div class="flex gap-2 shrink-0">
                        ${!isFile ? `<button onclick="window.openVideoAnalytics('${item.id}')" class="text-slate-300 hover:text-blue-500 transition-colors" title="View Analytics"><i class="fas fa-eye text-xs"></i></button>` : ''}
                        <button onclick="window.openEditContentModal('${encodeURIComponent(JSON.stringify(item))}')" class="text-slate-300 hover:text-brand-primary transition-colors"><i class="fas fa-pencil-alt text-xs"></i></button>
                        <button onclick="window.deleteContent('${item.id}', '${item.section || 'content'}')" class="text-slate-300 hover:text-red-500 transition-colors"><i class="fas fa-trash text-xs"></i></button>
                    </div>` : ''}
                </div>
                
                ${attachments.length > 1 ? `
                <div class="mt-4 pt-4 border-t border-slate-50 dark:border-slate-700/50">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Additional Files</p>
                    <div class="flex flex-wrap gap-2">
                        ${attachments.slice(1).map(att => `
                            <button onclick="window.openFileViewer('${att.url.replace(/'/g, "\\'")}', 'file')" class="text-[10px] font-bold bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-600 hover:border-brand-primary transition-colors truncate max-w-[120px]">
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
