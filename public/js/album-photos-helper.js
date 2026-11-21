(function (globalScope) {
    'use strict';

    const state = {
        images: [],
        selectedIds: new Set(),
        lastSelectedIndex: null
    };

    function getEscaper(customEscapeFn) {
        if (typeof customEscapeFn === 'function') return customEscapeFn;
        if (typeof globalScope.escapeHtml === 'function') return globalScope.escapeHtml;
        return function defaultEscape(str) {
            return String(str ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };
    }

    function updateToolbarUi() {
        const totalCount = state.images.length;
        const selectedCount = state.selectedIds.size;

        const toolbar = document.getElementById('albumPhotosBulkToolbar');
        const hintEl = document.getElementById('albumPhotosHint');
        if (toolbar) {
            toolbar.style.display = totalCount > 0 ? 'flex' : 'none';
        }
        if (hintEl) {
            hintEl.style.display = totalCount > 0 ? 'block' : 'none';
        }

        const selectAllCheckbox = document.getElementById('selectAllAlbumPhotos');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = totalCount > 0 && selectedCount === totalCount;
            selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalCount;
        }

        const summaryEl = document.getElementById('albumSelectedSummary');
        if (summaryEl) {
            summaryEl.textContent = `${selectedCount} selected`;
            summaryEl.classList.toggle('has-selection', selectedCount > 0);
        }

        const clearBtn = document.getElementById('btnClearPhotoSelection');
        if (clearBtn) {
            clearBtn.style.display = selectedCount > 0 ? 'inline-flex' : 'none';
        }

        const deleteBtn = document.getElementById('btnDeleteSelectedPhotos');
        if (deleteBtn) {
            deleteBtn.disabled = selectedCount === 0;
        }

        const countSpan = document.getElementById('selectedPhotosCount');
        if (countSpan) {
            countSpan.textContent = String(selectedCount);
        }
    }

    function syncCardsDom() {
        const grid = document.getElementById('albumPhotosGrid');
        if (!grid || typeof grid.querySelectorAll !== 'function') {
            updateToolbarUi();
            return;
        }
        const cards = grid.querySelectorAll('.album-photo-card');
        cards.forEach((card) => {
            const id = Number(card.getAttribute('data-image-id'));
            const isSelected = state.selectedIds.has(id);
            card.classList.toggle('is-selected', isSelected);
            const checkbox = card.querySelector('.album-photo-checkbox');
            if (checkbox) checkbox.checked = isSelected;
        });
        updateToolbarUi();
    }

    function applyRangeSelection(startIdx, endIdx, shouldSelect) {
        const low = Math.max(0, Math.min(startIdx, endIdx));
        const high = Math.min(state.images.length - 1, Math.max(startIdx, endIdx));
        for (let i = low; i <= high; i++) {
            const imgId = Number(state.images[i] && state.images[i].image_id);
            if (!imgId) continue;
            if (shouldSelect) {
                state.selectedIds.add(imgId);
            } else {
                state.selectedIds.delete(imgId);
            }
        }
    }

    function setPhotoSelected(imageId, index, checked, shiftKey = false) {
        const id = Number(imageId);
        if (!id) return;
        const targetChecked = Boolean(checked);

        if (shiftKey && state.lastSelectedIndex !== null && Number.isInteger(index)) {
            applyRangeSelection(state.lastSelectedIndex, index, targetChecked);
        } else if (targetChecked) {
            state.selectedIds.add(id);
        } else {
            state.selectedIds.delete(id);
        }

        if (Number.isInteger(index)) {
            state.lastSelectedIndex = index;
        }
        syncCardsDom();
    }

    function handleCheckboxClick(imageId, index, event) {
        if (event && typeof event.stopPropagation === 'function') {
            event.stopPropagation();
        }
        const checkbox = event && event.target ? event.target : null;
        const nextChecked = checkbox ? Boolean(checkbox.checked) : !state.selectedIds.has(Number(imageId));
        setPhotoSelected(imageId, index, nextChecked, Boolean(event && event.shiftKey));
    }

    function handleCardClick(imageId, index, event) {
        if (event && event.target && typeof event.target.closest === 'function') {
            if (event.target.closest('.album-photo-single-delete') || event.target.closest('.album-photo-select-wrap')) {
                return;
            }
        }
        const id = Number(imageId);
        const nextChecked = !state.selectedIds.has(id);
        setPhotoSelected(id, index, nextChecked, Boolean(event && event.shiftKey));
    }

    function toggleSelectAll(checked) {
        if (checked) {
            state.images.forEach((img) => {
                const id = Number(img && img.image_id);
                if (id) state.selectedIds.add(id);
            });
        } else {
            state.selectedIds.clear();
        }
        state.lastSelectedIndex = null;
        syncCardsDom();
    }

    function clearSelection() {
        toggleSelectAll(false);
    }

    function deselectId(imageId) {
        state.selectedIds.delete(Number(imageId));
        syncCardsDom();
    }

    function reset() {
        state.images = [];
        state.selectedIds.clear();
        state.lastSelectedIndex = null;
        updateToolbarUi();
    }

    function getSelectedIds() {
        return Array.from(state.selectedIds);
    }

    function renderGrid(gridEl, images, escapeFn) {
        const list = Array.isArray(images) ? images : [];
        const validIds = new Set(list.map((img) => Number(img.image_id)).filter(Boolean));
        state.images = list;
        for (const id of Array.from(state.selectedIds)) {
            if (!validIds.has(id)) state.selectedIds.delete(id);
        }
        state.lastSelectedIndex = null;

        if (!gridEl) return;

        if (list.length === 0) {
            gridEl.innerHTML = '<p class="text-slate-400 p-4 col-span-full" style="grid-column: 1 / -1;">No photos in this album yet. Select image files above to upload.</p>';
            updateToolbarUi();
            return;
        }

        const esc = getEscaper(escapeFn);
        gridEl.innerHTML = list.map((img, idx) => {
            const imgId = Number(img.image_id);
            const isSelected = state.selectedIds.has(imgId);
            const captionText = esc(img.caption || '');
            const safeSrc = esc(img.image_path);
            const altText = esc(img.caption || 'Album Photo');
            return `
                <div class="album-photo-card${isSelected ? ' is-selected' : ''}" data-image-id="${imgId}" data-index="${idx}" onclick="window.AlbumPhotosManager.handleCardClick(${imgId}, ${idx}, event)">
                    <div class="album-photo-select-wrap" title="Select photo for deletion" onclick="event.stopPropagation()">
                        <input type="checkbox" class="album-photo-checkbox" aria-label="Select photo ${captionText || imgId}"${isSelected ? ' checked' : ''} onclick="window.AlbumPhotosManager.handleCheckboxClick(${imgId}, ${idx}, event)">
                    </div>
                    <img src="${safeSrc}" alt="${altText}" loading="lazy" onerror="this.onerror=null; this.src='/images/sermon-placeholder.jpg';">
                    <div class="album-photo-overlay">
                        <span class="text-xs text-white truncate" style="max-width: 110px; font-weight: 500;">${captionText}</span>
                        <button type="button" class="album-photo-single-delete" onclick="event.stopPropagation(); deleteAlbumPhoto(${imgId})" title="Delete this photo" aria-label="Delete this photo">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        updateToolbarUi();
    }

    async function deleteSelected({ albumId, apiClient, confirmModal, notify, reloadPhotos }) {
        const selectedIds = getSelectedIds();
        if (selectedIds.length === 0) {
            if (typeof notify === 'function') notify('Please select at least one photo to delete.');
            return false;
        }

        const count = selectedIds.length;
        const noun = count === 1 ? 'photo' : 'photos';
        if (typeof confirmModal === 'function') {
            const ok = await confirmModal({
                title: 'Delete Selected Photos',
                message: `Are you sure you want to delete ${count} selected ${noun} from this album? This action cannot be undone.`,
                confirmText: `Delete ${count} ${count === 1 ? 'Photo' : 'Photos'}`,
                type: 'danger',
                icon: 'fa-trash-can'
            });
            if (!ok) return false;
        }

        const res = await apiClient.gallery.deleteImagesBulk(selectedIds, albumId);
        const deletedCount = (res && res.data && res.data.deletedCount) || count;
        reset();
        if (typeof notify === 'function') {
            notify(`Successfully deleted ${deletedCount} ${deletedCount === 1 ? 'photo' : 'photos'}!`);
        }
        if (typeof reloadPhotos === 'function' && albumId) {
            await reloadPhotos(albumId);
        }
        return true;
    }

    globalScope.AlbumPhotosManager = {
        renderGrid,
        handleCardClick,
        handleCheckboxClick,
        setPhotoSelected,
        toggleSelectAll,
        clearSelection,
        deselectId,
        reset,
        getSelectedIds,
        deleteSelected,
        updateToolbarUi
    };
})(typeof window !== 'undefined' ? window : globalThis);
