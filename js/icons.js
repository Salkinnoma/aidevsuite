const icons = {
    _iconBase(pathHtml, title = null, useTooltipInstead = false){
        const element = fromHTML(`<svg xmlns="http://www.w3.org/2000/svg" class="icon">` + pathHtml);

        if (title != null) {
            if (useTooltipInstead) {
                const titleElement =  document.createElement('title');
                titleElement.textContent = title;
                element.appendChild(titleElement);
            } else {
                element.setAttribute('tooltipHtml', title);
            }
        }

        return element;
    },
    materialIcon(path, title = null, useTooltipInstead = false) {
        const element = icons._iconBase(path, title, useTooltipInstead);
        element.setAttribute('viewBox', '0 -960 960 960');
        return element;
    },
    heroIcon(path, title = null, css = '', useTooltipInstead = false) {
        const element = icons._iconBase(path, title, useTooltipInstead);
        element.setAttribute('stroke-width', '1.5');
        element.setAttribute('stroke', 'currentColor');
        element.setAttribute('viewBox', '0 0 24 24');
        element.classList.add('noFill');
        return element;
    },
    close(title = null, useTooltipInstead = false) {
        let path = '<path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />';
        return this.materialIcon(path, title, useTooltipInstead);
    },
    expandMore(title = null, useTooltipInstead = false) {
        let path = '<path d="M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z"/>';
        return this.materialIcon(path, title, useTooltipInstead);
    },
    expandLess(title = null, useTooltipInstead = false) {
        let path = '<path d="m296-345-56-56 240-240 240 240-56 56-184-184-184 184Z"/>';
        return this.materialIcon(path, title, useTooltipInstead);
    },
    menu(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />';
        return this.heroIcon(path, title, useTooltipInstead);
    },
    menuClose(title = null, useTooltipInstead = false) {
        let path = '<path d="M200-440v-80h560v80H200Z"/>';
        return this.materialIcon(path, title, useTooltipInstead);
    },
    menuHorizontal(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />';
        return this.heroIcon(path, title, useTooltipInstead);
    },
    download(title = null, useTooltipInstead = false) {
        let path = '<path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>';
        return this.materialIcon(path, title, useTooltipInstead);
    },
    upload(title = null, useTooltipInstead = false) {
        let path = '<path d="M440-160v-326L336-382l-56-58 200-200 200 200-56 58-104-104v326h-80ZM160-600v-120q0-33 23.5-56.5T240-800h480q33 0 56.5 23.5T800-720v120h-80v-120H240v120h-80Z"/>';
        return this.materialIcon(path, title, useTooltipInstead);
    },
    lock(title = null, useTooltipInstead = false) {
        let path = '<path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm240-120q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM240-160v-400 400Z"/>';
        return this.materialIcon(path, title, useTooltipInstead);
    },
    noLock(title = null, useTooltipInstead = false) {
        let path = '<path d="m800-274-80-80v-206H514l-80-80h166v-80q0-50-34.5-85T481-840q-50 0-84 34.5T363-720v9l-73-73q22-61 75-98.5T481-920q83 0 141 58.5T680-720v80h40q33 0 56.5 23.5T800-560v286Zm20 246-62-62q-11 5-20 7.5T720-80H240q-33 0-56.5-23.5T160-160v-400q0-25 14.5-46t37.5-30L28-820l56-56L876-84l-56 56ZM686-160 539-309q-11 11-25.5 17t-31.5 6q-33 0-56.5-23.5T402-366q0-17 6-31.5t17-25.5L286-560h-46v400h446ZM486-360Zm131-97Z"/>';
        return this.materialIcon(path, title, useTooltipInstead);
    },
    edit(title = null, useTooltipInstead = false) {
        let path = '<path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>';
        return this.materialIcon(path, title, useTooltipInstead);
    },
    noEdit(title = null, useTooltipInstead = false) {
        let path = '<path d="m622-453-56-56 82-82-57-57-82 82-56-56 195-195q12-12 26.5-17.5T705-840q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L622-453ZM200-200h57l195-195-28-29-29-28-195 195v57ZM792-56 509-338 290-120H120v-169l219-219L56-792l57-57 736 736-57 57Zm-32-648-56-56 56 56Zm-169 56 57 57-57-57ZM424-424l-29-28 57 57-28-29Z"/>';
        return this.materialIcon(path, title, useTooltipInstead);
    },
    delete(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />';
        return this.heroIcon(path, title, useTooltipInstead);
    },
    highlight(title = null, useTooltipInstead = false) {
        let path = '<path d="M658-234h190v22H636l22-22Zm-481 22-47-48q-17-16-17-37t16-38l401-425q16-17 37.5-16.5T605-759l155 157q16 17 17 38.5T761-526L461-212H177Z"/>';
        return this.materialIcon(path, title, useTooltipInstead);
    },
    highlightOff(title = null, useTooltipInstead = false) {
        let path = '<path d="M793-136 586-343 477-229q-8 9-18 13t-21 4H199q-11 0-21-4.5T160-229l-30-31q-17-16-17-37t16-38l226-238-219-220q-3-3-3.5-7.5t3.5-8.5q3-3 7.5-3t8.5 3l657 657q2 3 2.5 8t-2.5 8q-4 4-8.5 4t-7.5-4Zm-16-428q1 10-3 20t-13 18l-94 99q-6 7-15 7t-15-7L436-628q-7-6-7-15t6-15l95-102q8-9 17.5-12.5T567-776q10 0 20 4t18 13l155 157q8 9 12.5 18.5T777-564Z"/>';
        return this.materialIcon(path, title, useTooltipInstead);
    },
    play(title = null, useTooltipInstead = false) {
        let path = '<path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />';
        return this.heroIcon(path, title, useTooltipInstead);
    },
}