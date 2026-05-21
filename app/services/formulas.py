from statistics import mean

from app.models.schemas import FinalScoreInput, FinalScoreResponse, JudgeScoreInput, Modality


JUDGE_WEIGHT = 0.80
PUBLIC_WEIGHT = 0.20

STATIC_WEIGHTS = {
    "strength": 0.35,
    "flexibility": 0.25,
    "endurance": 0.25,
    "coordination": 0.15,
}

DYNAMIC_WEIGHTS = {
    "coordination": 0.35,
    "endurance": 0.25,
    "strength": 0.25,
    "flexibility": 0.15,
}


def judge_technical_score(score: JudgeScoreInput, modality: Modality) -> float:
    weights = STATIC_WEIGHTS if modality == Modality.STATIC else DYNAMIC_WEIGHTS
    return (
        score.coordination * weights["coordination"]
        + score.strength * weights["strength"]
        + score.endurance * weights["endurance"]
        + score.flexibility * weights["flexibility"]
    )


def aggregate_judges(scores: list[JudgeScoreInput], modality: Modality) -> float:
    return mean(judge_technical_score(score, modality) for score in scores)


def calculate_final_score(payload: FinalScoreInput) -> FinalScoreResponse:
    judges_score = aggregate_judges(payload.judge_scores, payload.modality)
    judges_component = judges_score * JUDGE_WEIGHT
    public_component = payload.public_score * PUBLIC_WEIGHT
    return FinalScoreResponse(
        modality=payload.modality,
        judges_component=round(judges_component, 2),
        public_component=round(public_component, 2),
        final_score=round(judges_component + public_component, 2),
    )
