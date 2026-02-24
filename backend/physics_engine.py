import numpy as np

def calculate_angle(a, b, c):
    """
    Calculate the angle between three points: a, b, c.
    Returns the angle in degrees at vertex b.
    Points are [x, y] coordinates.
    """
    a = np.array(a[:2])
    b = np.array(b[:2])
    c = np.array(c[:2])

    ba = a - b
    bc = c - b

    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
    # Ensure cosine is within valid bounds [-1, 1] due to floating point
    cosine_angle = np.clip(cosine_angle, -1.0, 1.0)
    angle = np.arccos(cosine_angle)
    
    return np.degrees(angle)

def calculate_vertical_angle(a, b):
    """
    Calculate angle of segment a-b relative to vertical [0, 1] vector.
    """
    a = np.array(a[:2])
    b = np.array(b[:2])
    
    ab = b - a # Vector from a to b (e.g. shoulder to hip)
    vertical = np.array([0, 1])
    
    cosine_angle = np.dot(ab, vertical) / (np.linalg.norm(ab) * np.linalg.norm(vertical) + 1e-8)
    cosine_angle = np.clip(cosine_angle, -1.0, 1.0)
    angle = np.arccos(cosine_angle)
    
    return np.degrees(angle)

def analyze_smash(keypoints):
    """
    Logic for Overhead Smash: Detect if the racket arm (Shoulder-Elbow-Wrist) 
    reaches >165 degrees at the peak Y-coordinate.
    Returns a dictionary with smash metrics.
    """
    # Ultralytics Pose Keypoint Indices
    # 5: L_Shoulder, 6: R_Shoulder, 7: L_Elbow, 8: R_Elbow, 9: L_Wrist, 10: R_Wrist
    l_shoulder, l_elbow, l_wrist = keypoints[5], keypoints[7], keypoints[9]
    r_shoulder, r_elbow, r_wrist = keypoints[6], keypoints[8], keypoints[10]

    # Use the arm with the highest wrist (lowest Y value in image coordinates)
    if l_wrist[1] < r_wrist[1]:
        shoulder, elbow, wrist = l_shoulder, l_elbow, l_wrist
        arm = "Left"
    else:
        shoulder, elbow, wrist = r_shoulder, r_elbow, r_wrist
        arm = "Right"

    angle = calculate_angle(shoulder, elbow, wrist)
    is_smash_pose = angle > 165
    
    # Ensure wrist is above the shoulder
    is_wrist_high = wrist[1] < shoulder[1]
    
    return {
        "is_smash": bool(is_smash_pose and is_wrist_high),
        "arm_angle": round(float(angle), 2),
        "racket_arm": arm
    }

def analyze_ready_stance(keypoints):
    """
    Logic for Ready Stance: 
    Detect if knee flexion is between 25-35 degrees and if the torso is upright.
    """
    # 5: L_Shoulder, 6: R_Shoulder, 11: L_Hip, 12: R_Hip, 13: L_Knee, 14: R_Knee, 15: L_Ankle, 16: R_Ankle
    l_hip, l_knee, l_ankle = keypoints[11], keypoints[13], keypoints[15]
    r_hip, r_knee, r_ankle = keypoints[12], keypoints[14], keypoints[16]
    l_shoulder, r_shoulder = keypoints[5], keypoints[6]
    
    # Midpoints for torso
    mid_shoulder = (np.array(l_shoulder[:2]) + np.array(r_shoulder[:2])) / 2
    mid_hip = (np.array(l_hip[:2]) + np.array(r_hip[:2])) / 2
    
    l_knee_angle = calculate_angle(l_hip, l_knee, l_ankle)
    r_knee_angle = calculate_angle(r_hip, r_knee, r_ankle)
    
    # Flexion degree from 180 (straight)
    l_flexion = abs(180 - l_knee_angle)
    r_flexion = abs(180 - r_knee_angle)
    avg_flexion = (l_flexion + r_flexion) / 2
    
    torso_angle = calculate_vertical_angle(mid_shoulder, mid_hip)
    # Upright typically means torso angle to vertical is small
    
    is_knee_bent = 25 <= avg_flexion <= 35
    is_torso_upright = torso_angle < 15
    
    return {
        "is_ready_stance": bool(is_knee_bent and is_torso_upright),
        "avg_knee_flexion": round(float(avg_flexion), 2),
        "torso_angle": round(float(torso_angle), 2)
    }
