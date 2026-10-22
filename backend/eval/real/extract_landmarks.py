"""Extract MediaPipe Pose landmarks from workout videos for the Fire-Fit evaluation.

Runs the same model the phone companion uses (Pose Landmarker, full) in VIDEO mode
and writes one JSON per video: image landmarks (normalised x, y, z, visibility),
3D world landmarks (metres, hip-centred) and a timestamp per frame.

    pip install mediapipe opencv-python
    curl -LO https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
    python extract_landmarks.py --model pose_landmarker_full.task videos/*.mp4

Output: landmarks/<video name>.json (next to this script unless --out is given).
"""
import argparse
import json
import os
import sys

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision


def lm(points, with_vis=True):
    return [
        {"x": round(p.x, 5), "y": round(p.y, 5), "z": round(p.z, 5),
         **({"visibility": round(p.visibility, 3)} if with_vis else {})}
        for p in points
    ]


def extract(path, model, fps_cap):
    opts = vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=model),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    cap = cv2.VideoCapture(path)
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    step = max(1, round(src_fps / fps_cap))  # e.g. 60 fps video -> every 2nd frame
    frames = []
    with vision.PoseLandmarker.create_from_options(opts) as det:
        i = 0
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            if i % step == 0:
                t = int(round(i * 1000 / src_fps))
                rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                res = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), t)
                if res.pose_landmarks:
                    frames.append({"t": t, "image": lm(res.pose_landmarks[0]),
                                   "world": lm(res.pose_world_landmarks[0], with_vis=False)})
                else:
                    frames.append({"t": t, "image": None, "world": None})
            i += 1
    cap.release()
    return {"video": os.path.basename(path), "fps": src_fps / step, "width": w, "height": h, "frames": frames}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("videos", nargs="+")
    ap.add_argument("--model", required=True, help="pose_landmarker_full.task")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "landmarks"))
    ap.add_argument("--fps", type=float, default=30, help="process at most this many frames per second (phone runs 30)")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for v in a.videos:
        data = extract(v, a.model, a.fps)
        seen = sum(1 for f in data["frames"] if f["image"])
        name = os.path.splitext(os.path.basename(v))[0] + ".json"
        with open(os.path.join(a.out, name), "w") as fh:
            json.dump(data, fh, separators=(",", ":"))
        print(f"{v}: {len(data['frames'])} frames, person found in {seen}", file=sys.stderr)


if __name__ == "__main__":
    main()
