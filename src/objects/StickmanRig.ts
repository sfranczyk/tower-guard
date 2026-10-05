import { Container, Graphics, Rectangle, type FederatedPointerEvent } from 'pixi.js';

export type JointName =
  | 'head'
  | 'shoulder'
  | 'hip'
  | 'leftElbow'
  | 'leftHand'
  | 'rightElbow'
  | 'rightHand'
  | 'leftKnee'
  | 'leftFoot'
  | 'rightKnee'
  | 'rightFoot';

type Point = { x: number; y: number };

type Joint = {
  name: JointName;
  position: Point;
  handle: Graphics;
};

type Bone = {
  from: JointName;
  to: JointName;
  length: number;
};

const INITIAL_POSITIONS: Record<JointName, Point> = {
  head: { x: 8, y: -118 },
  shoulder: { x: 4, y: -88 },
  hip: { x: 0, y: -38 },
  leftElbow: { x: -16, y: -68 },
  leftHand: { x: -20, y: -30 },
  rightElbow: { x: 38, y: -67 },
  rightHand: { x: 55, y: -33 },
  leftKnee: { x: -12, y: 15 },
  leftFoot: { x: -18, y: 62 },
  rightKnee: { x: 28, y: 7 },
  rightFoot: { x: 47, y: 59 },
};

const BONE_PAIRS: Array<[JointName, JointName]> = [
  ['head', 'shoulder'],
  ['shoulder', 'hip'],
  ['shoulder', 'leftElbow'],
  ['leftElbow', 'leftHand'],
  ['shoulder', 'rightElbow'],
  ['rightElbow', 'rightHand'],
  ['hip', 'leftKnee'],
  ['leftKnee', 'leftFoot'],
  ['hip', 'rightKnee'],
  ['rightKnee', 'rightFoot'],
];

const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

export default class StickmanRig extends Container {
  private readonly skeleton: Graphics;
  private readonly joints = new Map<JointName, Joint>();
  private readonly bones: Bone[];
  private draggedJoint?: JointName;
  private readonly accentColor: number;

  public constructor(accentColor = 0x67a7ff) {
    super();
    this.accentColor = accentColor;
    this.skeleton = new Graphics();
    this.addChild(this.skeleton);

    (Object.keys(INITIAL_POSITIONS) as JointName[]).forEach((name) => {
      const position = { ...INITIAL_POSITIONS[name] };
      const handle = new Graphics();
      handle.eventMode = 'static';
      handle.cursor = 'grab';
      handle.hitArea = new Rectangle(-12, -12, 24, 24);
      handle.on('pointerdown', (event: FederatedPointerEvent) => this.startDrag(name, event));
      this.addChild(handle);
      handle.position.set(position.x, position.y);
      this.joints.set(name, { name, position, handle });
    });

    this.bones = BONE_PAIRS.map(([from, to]) => ({
      from,
      to,
      length: distance(INITIAL_POSITIONS[from], INITIAL_POSITIONS[to]),
    }));

    this.eventMode = 'static';
    this.on('globalpointermove', (event: FederatedPointerEvent) => this.moveDrag(event));
    this.on('globalpointerup', () => this.stopDrag());
    this.on('pointerup', () => this.stopDrag());
    this.on('pointerupoutside', () => this.stopDrag());
    this.redraw();
  }

  public get draggedJointName(): JointName | undefined {
    return this.draggedJoint;
  }

  public update(deltaMs: number): void {
    const pulse = 0.7 + Math.sin(deltaMs / 1000) * 0.1;
    this.joints.forEach((joint) => {
      joint.handle.alpha = joint.name === this.draggedJoint ? 1 : pulse;
    });
  }

  private startDrag(name: JointName, event: FederatedPointerEvent): void {
    event.stopPropagation();
    this.draggedJoint = name;
    this.joints.get(name)?.handle && (this.joints.get(name)!.handle.cursor = 'grabbing');
    this.moveDrag(event);
  }

  private moveDrag(event: FederatedPointerEvent): void {
    if (!this.draggedJoint) {
      return;
    }

    const point = this.toLocal(event.global);
    const joint = this.joints.get(this.draggedJoint);
    if (!joint) {
      return;
    }
    joint.position = { x: point.x, y: point.y };
    this.solveConstraints(this.draggedJoint);
    this.redraw();
  }

  private stopDrag(): void {
    if (!this.draggedJoint) {
      return;
    }
    this.joints.get(this.draggedJoint)?.handle && (this.joints.get(this.draggedJoint)!.handle.cursor = 'grab');
    this.draggedJoint = undefined;
    this.redraw();
  }

  private solveConstraints(pinned: JointName): void {
    for (let iteration = 0; iteration < 32; iteration += 1) {
      for (const bone of this.bones) {
        const from = this.joints.get(bone.from)!.position;
        const to = this.joints.get(bone.to)!.position;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const currentLength = Math.hypot(dx, dy) || 1;
        const correction = (currentLength - bone.length) / currentLength;

        if (bone.from === pinned) {
          to.x -= dx * correction;
          to.y -= dy * correction;
        } else if (bone.to === pinned) {
          from.x += dx * correction;
          from.y += dy * correction;
        } else {
          const halfX = dx * correction * 0.5;
          const halfY = dy * correction * 0.5;
          from.x += halfX;
          from.y += halfY;
          to.x -= halfX;
          to.y -= halfY;
        }
      }
    }
  }

  private redraw(): void {
    this.skeleton.clear();
    const rearColor = 0x8d9ab1;
    const drawBone = (bone: Bone, rear = false): void => {
      const from = this.joints.get(bone.from)!.position;
      const to = this.joints.get(bone.to)!.position;
      this.skeleton
        .moveTo(from.x, from.y)
        .lineTo(to.x, to.y)
        .stroke({ width: rear ? 7 : 9, color: rear ? rearColor : this.accentColor, cap: 'round' });
    };

    this.bones.slice(2, 6).forEach((bone, index) => drawBone(bone, index < 2));
    this.bones.slice(6).forEach((bone, index) => drawBone(bone, index < 2));
    this.bones.slice(0, 2).forEach((bone) => drawBone(bone));

    const head = this.joints.get('head')!.position;
    this.skeleton.circle(head.x, head.y, 17).fill({ color: 0xd99575 }).stroke({ width: 4, color: 0x18253a });
    this.skeleton
      .moveTo(head.x - 14, head.y - 8)
      .lineTo(head.x, head.y - 22)
      .lineTo(head.x + 15, head.y - 8)
      .lineTo(head.x + 9, head.y - 3)
      .lineTo(head.x - 10, head.y - 3)
      .closePath()
      .fill({ color: this.accentColor });

    this.joints.forEach((joint) => {
      const radius = joint.name === 'head' ? 0 : 7;
      joint.handle.clear();
      if (radius > 0) {
        joint.handle
          .circle(0, 0, radius)
          .fill({ color: joint.name === this.draggedJoint ? 0xffd166 : 0xf5f7fb })
          .stroke({ width: 2, color: 0x18253a });
      }
      joint.handle.position.set(joint.position.x, joint.position.y);
    });
  }
}
