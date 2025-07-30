package types

type RewardUnlockId string

var (
	CUSTOM_PROFILE_PIC RewardUnlockId = "CUSTOM_PROFILE_PIC"
)

type AchievementField string

var (
	SUBMISSION_STREAK AchievementField = "SUBMISSION_STREAK"
	SUBMISSION_TOTAL  AchievementField = "SUBMISSION_TOTAL"
	COMMENT_TOTAL     AchievementField = "COMMENT_TOTAL"
	REACTION_TOTAL    AchievementField = "REACTION_TOTAL"
	FRIEND_TOTAL      AchievementField = "FRIEND_TOTAL"
)
