import {Addon} from "../Addon";
import {registerRenderer} from "./registerRenderer";
import {registerStyle} from "./registerStyle";

export class HideOcclusionData extends Addon {
    private dispose?: () => void;

    public getName(): string {
        return "Hide Occlusion Data";
    }

    public init(): void {
        this.dispose?.();
        this.dispose = undefined;
        const enabled = this.isEnabled();
        registerStyle(enabled);
        if (enabled) this.dispose = registerRenderer(() => this.isEnabled());
    }

    public override remove(): void {
        this.dispose?.();
        this.dispose = undefined;
        super.remove();
    }
}
