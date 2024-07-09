class InputHelpers {
    static fixNumberInput(element) {
        let newValue = parseInt(element.value);
        if (isNaN(newValue)) newValue = 0;
        if (element.value !== newValue) element.value = newValue;
        return newValue;
    }
}