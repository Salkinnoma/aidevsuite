
function closeAllDialogs() {
    let dialogs = document.getElementsByClassName("dialog");
    for (let dialog of dialogs) {
        dialog.classList.add("hide");
    }
}

function escapeDialogs(e) {
    if (e.key == "Escape") {
        closeAllDialogs();
    }
}
window.addEventListener("keyup", e => escapeDialogs(e));
