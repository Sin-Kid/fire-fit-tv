# YouTube upload

**Video file:** `docs/fire-fit-demo.mp4` (1:49) · **Thumbnail:** `apps/FireFitTV/dist/youtube-thumbnail-1.jpg`

## Title

Fire-Fit: AI Personal Trainer for Fire TV (Vega OS) + Phone as Camera

## Description

Fire-Fit turns a Fire TV into an AI personal trainer. The TV runs the workout, and your phone becomes the TV's camera and microphone.

Built for the Amazon Developer "Build, Ship, Shape" hackathon (Fire TV track). Shown running on Vega OS in the Vega Virtual Device, controlled with the remote.

WHAT IT DOES
• Builds your workout: pick goal, time, level, equipment and limits (like "knee friendly") with the remote. Amazon Bedrock (Amazon Nova 2 Lite) designs the session in seconds, with an on-device planner as a fallback.
• Coaches you on the TV: 32 animated exercise demos, big timers readable from across the room, form tips, an "easier" option for every move, and a coach recap at the end.
• Counts calories: enter weight, height and age once with big −/+ buttons (no typing). Live estimate from your resting burn (Mifflin-St Jeor) and each move's MET value.
• Phone as the TV's eyes and ears: Fire TV apps get no camera or microphone, so you scan a QR code and your phone takes over. MediaPipe Pose runs in the phone's browser to count reps and check form (squat depth, push-up hip sag and more), and speech recognition hears "start", "wait", "skip", "rest", "slow down" and "easier". Everything shows and is spoken on the TV. Video never leaves the phone.
• Laptop mode: open it in a laptop browser and it uses the webcam and mic directly, detected automatically.

CHAPTERS
0:00 Intro: TV workouts are fixed videos
0:12 Running on Vega OS, controlled with the remote
0:31 Workout ready: scan the QR code
0:42 Phone becomes the TV's camera and mic
0:58 Follow along and real-time form coaching
1:14 Hands-free voice control and recap
1:29 Laptop mode and how it's built

HOW IT'S BUILT
• TV app: React Native, one codebase for Vega OS (Vega Virtual Device) and Fire OS. Sharp on 720p, 1080p and 4K screens.
• AI: Amazon Bedrock Converse API with a forced tool call, so the model returns a validated, structured workout.
• Backend: Node.js on AWS Lambda with DynamoDB for phone pairing.
• Vision: MediaPipe Pose Landmarker with 3D world landmarks, One Euro smoothing, and rule-based rep counting for 19 exercise families.

Source code: GitHub, Sin-Kid/fire-fit-tv
Open-source exercise animations: GitHub, Sin-Kid/tv-exercise-figures
Try the web version: fire-fit-tv.netlify.app

#FireTV #VegaOS #AmazonBedrock #AWS #MediaPipe #ReactNative #Fitness #AI #Hackathon
