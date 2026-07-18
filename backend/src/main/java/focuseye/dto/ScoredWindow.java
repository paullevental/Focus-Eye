package focuseye.dto;

import focuseye.model.FocusCategory;

/**
 * One scored ~1s window: the focus-intensity value for the graph plus the
 * predicted category. Controller maps raw {@link ScoreBatchRequest.Entry}
 * values to this (parsing the category) before handing off to the service.
 */
public record ScoredWindow(double score, FocusCategory type) {
}
