package simulation

import (
	"math"
)

// LTTBDownsample reduce el slice de DataPoint a 'threshold' puntos
// preservando los picos y valles mediante Largest-Triangle-Three-Buckets.
func LTTBDownsample(data []DataPoint, threshold int) []DataPoint {
	n := len(data)
	if threshold <= 0 || threshold >= n {
		return data
	}
	if threshold == 2 {
		return []DataPoint{data[0], data[n-1]}
	}

	result := make([]DataPoint, 0, threshold)
	result = append(result, data[0])

	bucketSize := float64(n-2) / float64(threshold-2)
	selectedIdx := 0

	for i := 0; i < threshold-2; i++ {
		currStart := int(math.Floor(float64(i)*bucketSize)) + 1
		currEnd := int(math.Floor(float64(i+1)*bucketSize)) + 1
		if currEnd >= n {
			currEnd = n - 1
		}

		nextStart := currEnd
		nextEnd := int(math.Floor(float64(i+2)*bucketSize)) + 1
		if nextEnd >= n {
			nextEnd = n - 1
		}

		var avgX, avgY float64
		nextLen := nextEnd - nextStart
		for j := nextStart; j < nextEnd; j++ {
			avgX += data[j].Time
			avgY += data[j].GlucoseReal
		}
		if nextLen > 0 {
			avgX /= float64(nextLen)
			avgY /= float64(nextLen)
		}

		ax := data[selectedIdx].Time
		ay := data[selectedIdx].GlucoseReal

		maxArea := -1.0
		maxIdx := currStart

		for j := currStart; j < currEnd; j++ {
			area := math.Abs(
				(ax-avgX)*(data[j].GlucoseReal-ay) -
					(ax-data[j].Time)*(avgY-ay),
			)
			if area > maxArea {
				maxArea = area
				maxIdx = j
			}
		}

		result = append(result, data[maxIdx])
		selectedIdx = maxIdx
	}

	result = append(result, data[n-1])
	return result
}
