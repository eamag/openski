class SettingsSheetState {
	open = $state(false);
	show(): void {
		this.open = true;
	}
	close(): void {
		this.open = false;
	}
}

export const settings = new SettingsSheetState();
