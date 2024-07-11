class IconHelpers {
    static materialIconProvider = "materialIconProvider";
    static heroIconProvider = "heroIconProvider";
    static _iconBase(pathHtml, title = null, useTooltipInstead = false){
        const element = fromHTML(`<svg xmlns="http://www.w3.org/2000/svg" class="icon">` + pathHtml);

        if (title != null) {
            if (useTooltipInstead) {
                const titleElement =  document.createElement('title');
                titleElement.textContent = title;
                element.appendChild(titleElement);
            } else {
                element.setAttribute('tooltip', title);
            }
        }

        return element;
    }

    static icon(path, type, title = null, useTooltipInstead = false) {
        if (type == IconHelpers.materialIconProvider) {
            return IconHelpers.materialIcon(path, title, useTooltipInstead);
        } else if (type == IconHelpers.heroIconProvider) {
            return IconHelpers.heroIcon(path, title, useTooltipInstead);
        }
    }

    static materialIcon(path, title = null, useTooltipInstead = false) {
        const element = IconHelpers._iconBase(path, title, useTooltipInstead);
        element.setAttribute('viewBox', '0 -960 960 960');
        return element;
    }

    static heroIcon(path, title = null, css = '', useTooltipInstead = false) {
        const element = IconHelpers._iconBase(path, title, useTooltipInstead);
        element.setAttribute('stroke-width', '1.5');
        element.setAttribute('stroke', 'currentColor');
        element.setAttribute('viewBox', '0 0 24 24');
        element.classList.add('noFill');
        return element;
    }

    static dsToPathHtml(ds, type) {
        let html = '';
        if (type == IconHelpers.materialIconProvider) {
            html = ds.map(d => `<path d="${escapeHTML(d)}"></path>`).join(' ');
        } else if (type == IconHelpers.heroIconProvider) {
            html = ds.map(d => `<path stroke-linecap="round" stroke-linejoin="round" d="${escapeHTML(d)}"></path>`).join(' ');
        }

        return html;
    }
}

const icons = {
    close(title = null, useTooltipInstead = false) {
        let path = '<path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />';
        return IconHelpers.materialIcon(path, title, useTooltipInstead);
    },
    expandMore(title = null, useTooltipInstead = false) {
        let path = '<path d="M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z"/>';
        return IconHelpers.materialIcon(path, title, useTooltipInstead);
    },
    expandLess(title = null, useTooltipInstead = false) {
        let path = '<path d="m296-345-56-56 240-240 240 240-56 56-184-184-184 184Z"/>';
        return IconHelpers.materialIcon(path, title, useTooltipInstead);
    },
    menu(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />';
        return IconHelpers.heroIcon(path, title, useTooltipInstead);
    },
    menuClose(title = null, useTooltipInstead = false) {
        let path = '<path d="M200-440v-80h560v80H200Z"/>';
        return IconHelpers.materialIcon(path, title, useTooltipInstead);
    },
    menuHorizontal(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />';
        return IconHelpers.heroIcon(path, title, useTooltipInstead);
    },
    download(title = null, useTooltipInstead = false) {
        let path = '<path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>';
        return IconHelpers.materialIcon(path, title, useTooltipInstead);
    },
    upload(title = null, useTooltipInstead = false) {
        let path = '<path d="M440-160v-326L336-382l-56-58 200-200 200 200-56 58-104-104v326h-80ZM160-600v-120q0-33 23.5-56.5T240-800h480q33 0 56.5 23.5T800-720v120h-80v-120H240v120h-80Z"/>';
        return IconHelpers.materialIcon(path, title, useTooltipInstead);
    },
    lock(title = null, useTooltipInstead = false) {
        let path = '<path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm240-120q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM240-160v-400 400Z"/>';
        return IconHelpers.materialIcon(path, title, useTooltipInstead);
    },
    noLock(title = null, useTooltipInstead = false) {
        let path = '<path d="m800-274-80-80v-206H514l-80-80h166v-80q0-50-34.5-85T481-840q-50 0-84 34.5T363-720v9l-73-73q22-61 75-98.5T481-920q83 0 141 58.5T680-720v80h40q33 0 56.5 23.5T800-560v286Zm20 246-62-62q-11 5-20 7.5T720-80H240q-33 0-56.5-23.5T160-160v-400q0-25 14.5-46t37.5-30L28-820l56-56L876-84l-56 56ZM686-160 539-309q-11 11-25.5 17t-31.5 6q-33 0-56.5-23.5T402-366q0-17 6-31.5t17-25.5L286-560h-46v400h446ZM486-360Zm131-97Z"/>';
        return this.materialIcon(path, title, useTooltipInstead);
    },
    edit(title = null, useTooltipInstead = false) {
        let path = '<path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>';
        return IconHelpers.materialIcon(path, title, useTooltipInstead);
    },
    noEdit(title = null, useTooltipInstead = false) {
        let path = '<path d="m622-453-56-56 82-82-57-57-82 82-56-56 195-195q12-12 26.5-17.5T705-840q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L622-453ZM200-200h57l195-195-28-29-29-28-195 195v57ZM792-56 509-338 290-120H120v-169l219-219L56-792l57-57 736 736-57 57Zm-32-648-56-56 56 56Zm-169 56 57 57-57-57ZM424-424l-29-28 57 57-28-29Z"/>';
        return IconHelpers.materialIcon(path, title, useTooltipInstead);
    },
    delete(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />';
        return IconHelpers.heroIcon(path, title, useTooltipInstead);
    },
    highlight(title = null, useTooltipInstead = false) {
        let path = '<path d="M658-234h190v22H636l22-22Zm-481 22-47-48q-17-16-17-37t16-38l401-425q16-17 37.5-16.5T605-759l155 157q16 17 17 38.5T761-526L461-212H177Z"/>';
        return IconHelpers.materialIcon(path, title, useTooltipInstead);
    },
    highlightOff(title = null, useTooltipInstead = false) {
        let path = '<path d="M793-136 586-343 477-229q-8 9-18 13t-21 4H199q-11 0-21-4.5T160-229l-30-31q-17-16-17-37t16-38l226-238-219-220q-3-3-3.5-7.5t3.5-8.5q3-3 7.5-3t8.5 3l657 657q2 3 2.5 8t-2.5 8q-4 4-8.5 4t-7.5-4Zm-16-428q1 10-3 20t-13 18l-94 99q-6 7-15 7t-15-7L436-628q-7-6-7-15t6-15l95-102q8-9 17.5-12.5T567-776q10 0 20 4t18 13l155 157q8 9 12.5 18.5T777-564Z"/>';
        return IconHelpers.materialIcon(path, title, useTooltipInstead);
    },
    play(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />';
        return IconHelpers.heroIcon(path, title, useTooltipInstead);
    },
    settings(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"></path>';
        return IconHelpers.heroIcon(path, title, useTooltipInstead);
    },
    sparkles(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"></path>';
        return IconHelpers.heroIcon(path, title, useTooltipInstead);
    },
    star(title = null, useTooltipInstead = false) {
        let path = '<path d="m305-704 112-145q12-16 28.5-23.5T480-880q18 0 34.5 7.5T543-849l112 145 170 57q26 8 41 29.5t15 47.5q0 12-3.5 24T866-523L756-367l4 164q1 35-23 59t-56 24q-2 0-22-3l-179-50-179 50q-5 2-11 2.5t-11 .5q-32 0-56-24t-23-59l4-165L95-523q-8-11-11.5-23T80-570q0-25 14.5-46.5T135-647l170-57Zm49 69-194 64 124 179-4 191 200-55 200 56-4-192 124-177-194-66-126-165-126 165Zm126 135Z"/>';
        return IconHelpers.materialIcon(path, title, useTooltipInstead);
    },
    starFilled(title = null, useTooltipInstead = false) {
        let path = '<path d="m305-704 112-145q12-16 28.5-23.5T480-880q18 0 34.5 7.5T543-849l112 145 170 57q26 8 41 29.5t15 47.5q0 12-3.5 24T866-523L756-367l4 164q1 35-23 59t-56 24q-2 0-22-3l-179-50-179 50q-5 2-11 2.5t-11 .5q-32 0-56-24t-23-59l4-165L95-523q-8-11-11.5-23T80-570q0-25 14.5-46.5T135-647l170-57Z"/>';
        return IconHelpers.materialIcon(path, title, useTooltipInstead);
    },
    copy(title = null, useTooltipInstead = false) {
        let path = '<path d="M358.27-260q-28.44 0-48.35-19.92Q290-299.83 290-328.27v-455.38q0-28.44 19.92-48.36 19.91-19.91 48.35-19.91h335.38q28.44 0 48.36 19.91 19.91 19.92 19.91 48.36v455.38q0 28.44-19.91 48.35Q722.09-260 693.65-260H358.27Zm0-55.96h335.38q4.62 0 8.46-3.85 3.85-3.84 3.85-8.46v-455.38q0-4.62-3.85-8.47-3.84-3.84-8.46-3.84H358.27q-4.62 0-8.46 3.84-3.85 3.85-3.85 8.47v455.38q0 4.62 3.85 8.46 3.84 3.85 8.46 3.85ZM226.35-128.08q-28.44 0-48.36-19.92-19.91-19.91-19.91-48.35v-511.34h55.96v511.34q0 4.62 3.85 8.46 3.84 3.85 8.46 3.85h391.34v55.96H226.35Zm119.61-187.88v-480 480Z"/>';
        return IconHelpers.materialIcon(path, title, useTooltipInstead);
    },
    user(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />';
        return IconHelpers.heroIcon(path, title, useTooltipInstead);
    },
    cpu(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />';
        return IconHelpers.heroIcon(path, title, useTooltipInstead);
    },
    link(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />';
        return IconHelpers.heroIcon(path, title, useTooltipInstead);
    },
    dollar(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />';
        return IconHelpers.heroIcon(path, title, useTooltipInstead);
    },
    at(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 1 0-2.636 6.364M16.5 12V8.25" />';
        return IconHelpers.heroIcon(path, title, useTooltipInstead);
    },
    photo(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />';
        return IconHelpers.heroIcon(path, title, useTooltipInstead);
    },
    retry(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />';
        return IconHelpers.heroIcon(path, title, useTooltipInstead);
    },
    undo(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />';
        return IconHelpers.heroIcon(path, title, useTooltipInstead);
    },
    redo(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />';
        return IconHelpers.heroIcon(path, title, useTooltipInstead);
    },
}